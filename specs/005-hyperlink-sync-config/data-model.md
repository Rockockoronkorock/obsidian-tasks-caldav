# Data Model: Hyperlink Sync Behavior Configuration

**Feature**: 005-hyperlink-sync-config | **Date**: 2026-02-04

## Overview

This document defines the data entities, transformations, and state models for the hyperlink sync configuration feature. The feature adds one new setting to the existing configuration, one new module for hyperlink processing, and modifies the sync engine's description assembly to accommodate extracted links.

---

## Core Entities

### 1. HyperlinkSyncMode (New Enum)

**Description**: The user-configurable setting that controls how markdown hyperlinks in task descriptions are handled during sync. This is the only new persistent entity introduced by this feature.

**Definition**:
```typescript
export enum HyperlinkSyncMode {
  Keep  = "keep",   // Hyperlinks remain in SUMMARY as raw markdown
  Move  = "move",   // URLs extracted to DESCRIPTION; display text stays in SUMMARY
  Strip = "strip",  // URLs removed entirely; only display text remains in SUMMARY
}
```

**Persistence**: Stored as a string field (`hyperlinkSyncMode`) in `CalDAVConfiguration` within `data.json`. Serializes as one of: `"keep"`, `"move"`, `"strip"`.

**Default**: `"keep"` — preserves existing behavior for users who upgrade without changing settings.

**Validation**: Must be one of the three enum values. If an invalid value is found in persisted data (e.g., from a downgrade), fall back to `"keep"`.

---

### 2. MarkdownHyperlink (Extracted, Transient)

**Description**: Represents a single well-formed markdown hyperlink extracted from a task description during processing. Not persisted; exists only during the sync transformation.

**Structure**:
```typescript
interface MarkdownHyperlink {
  displayText: string;   // The text between [ ] — may be empty string
  url: string;           // The URL between ( ) — always starts with http:// or https://
  raw: string;           // The full original markdown syntax: [displayText](url)
}
```

**Detection regex** (applied globally to description string):
```
/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g
```

**Validation rules**:
- `url` must start with `http://` or `https://`
- `displayText` may be empty (edge case: `[](url)`)
- `raw` is the full matched substring — used for precise replacement in the original string

**Lifecycle**: Created during `processDescription()`, consumed immediately to produce the processed summary and links block. Not stored.

---

### 3. ProcessedDescription (Transient)

**Description**: The output of hyperlink processing — a summary ready for CalDAV SUMMARY and an optional block of extracted links for DESCRIPTION. Not persisted.

**Structure**:
```typescript
interface ProcessedDescription {
  summary: string;           // The summary to send to CalDAV SUMMARY field
  extractedLinksBlock: string; // Formatted links block for DESCRIPTION (empty string if none)
}
```

**Derivation by mode**:

| Mode | `summary` | `extractedLinksBlock` |
|------|-----------|----------------------|
| `keep` | Original description unchanged | `""` (empty) |
| `move` | Each `[text](url)` replaced with `text`; whitespace normalized | `"Links:\n- text: url\n- text2: url2"` |
| `strip` | Each `[text](url)` replaced with `text`; whitespace normalized | `""` (empty) |

**Empty summary guard**: If the computed `summary` is empty or whitespace-only after processing, `summary` is set back to the original unmodified description and `extractedLinksBlock` is set to `""`.

---

## Configuration Extension

### CalDAVConfiguration (Modified)

**File**: `src/types.ts`

**Change**: Add one field:
```typescript
export interface CalDAVConfiguration {
  // ... existing fields ...

  /** How markdown hyperlinks in task descriptions are handled during sync (default: "keep") */
  hyperlinkSyncMode: HyperlinkSyncMode;
}
```

**Default** (in `src/settings.ts`):
```typescript
export const DEFAULT_SETTINGS: CalDAVConfiguration = {
  // ... existing defaults ...
  hyperlinkSyncMode: HyperlinkSyncMode.Keep,
};
```

---

## Data Transformations

### 1. Hyperlink Extraction

**Input**: `description: string` (raw task description from Obsidian)

**Output**: `links: MarkdownHyperlink[]` (all well-formed markdown hyperlinks found)

**Algorithm**:
1. Run regex `/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g` against description
2. For each match: capture group 1 = displayText, capture group 2 = url, full match = raw
3. Return array of `MarkdownHyperlink` objects (empty array if no matches)

**Examples**:
```
Input:  "Review the [project brief](https://example.com/brief) before Friday"
Output: [{ displayText: "project brief", url: "https://example.com/brief", raw: "[project brief](https://example.com/brief)" }]

Input:  "No links here"
Output: []

Input:  "[](https://example.com)"
Output: [{ displayText: "", url: "https://example.com", raw: "[](https://example.com)" }]
```

---

### 2. Summary Transformation (Move / Strip)

**Input**: `description: string`, `links: MarkdownHyperlink[]`

**Output**: `processedSummary: string`

**Algorithm**:
1. For each link in `links`, replace `link.raw` in description with `link.displayText`
2. Normalize whitespace: collapse multiple consecutive spaces into one, trim leading/trailing whitespace
3. If result is empty or whitespace-only, return original `description` unchanged (empty summary guard)

**Why replace with `displayText` for both Move and Strip?**
- In **Move** mode: the URL is preserved in the links block (DESCRIPTION), so only the display text needs to remain in SUMMARY.
- In **Strip** mode: the URL is discarded entirely; only the display text remains.
- The summary transformation is identical for both modes. The difference is whether `extractedLinksBlock` is populated.

**Examples**:
```
Input:  "Review [brief](https://example.com) and [spec](https://spec.com)"
Links:  [{ displayText: "brief", ... }, { displayText: "spec", ... }]
Output: "Review brief and spec"

Input:  "[](https://example.com) is the link"
Links:  [{ displayText: "", ... }]
Output: "is the link"   (leading space normalized away)

Input:  "[](https://example.com)"
Links:  [{ displayText: "", ... }]
Output: "[](https://example.com)"  ← empty summary guard: falls back to original
```

---

### 3. Links Block Formatting (Move mode only)

**Input**: `links: MarkdownHyperlink[]`

**Output**: `linksBlock: string` — plain text block suitable for DESCRIPTION

**Algorithm**:
1. If `links` is empty, return `""` (empty string)
2. Otherwise, produce:
   ```
   Links:
   - {displayText or url}: {url}
   ```
   Where: if `displayText` is empty, use the URL itself as the label (avoids a bare `: url` line)

**Examples**:
```
Input:  [{ displayText: "brief", url: "https://example.com/brief" }]
Output: "Links:\n- brief: https://example.com/brief"

Input:  [{ displayText: "", url: "https://example.com" }]
Output: "Links:\n- https://example.com: https://example.com"

Input:  []
Output: ""
```

---

### 4. DESCRIPTION Assembly (Create path only)

**Input**: `extractedLinksBlock: string`, `obsidianURI: string | undefined`

**Output**: `description: string | undefined` — the full DESCRIPTION value to send to CalDAV

**Assembly rules** (in `engine.ts`, before passing to `client.createTask()`):

| extractedLinksBlock | obsidianURI | Result |
|---------------------|-------------|--------|
| `""` | defined | `"\n\nObsidian Link: {uri}"` (existing 003 behavior) |
| non-empty | defined | `"{linksBlock}\n\nObsidian Link: {uri}"` |
| `""` | undefined | `undefined` (no DESCRIPTION) |
| non-empty | undefined | `"{linksBlock}"` |

This is implemented by passing `extractedLinksBlock` as the `existingContent` parameter to the updated `buildDescriptionWithURI()`, which is modified to prepend non-empty existing content.

---

## State Models

### Setting State

```
[Plugin installed / upgraded]
        ↓
[hyperlinkSyncMode = "keep" (default)]
        ↓
[User opens Settings → Sync section]
        ↓
[User selects "Move to Notes" or "Strip hyperlinks"]
        ↓
[hyperlinkSyncMode = "move" | "strip", saved to data.json]
        ↓
[Next sync applies new mode to outgoing task summaries]
```

The setting is stateless between syncs — it is simply read at sync time. No migration or retroactive application occurs.

### Hyperlink Processing State (Per-Task, Transient)

```
[Task description read from vault]
        ↓
[Mode read from settings]
        ↓
[if mode == "keep"] → summary unchanged, no links block
        ↓
[if mode == "move" or "strip"] → extract links → transform summary
        ↓
[if mode == "move"] → format links block
        ↓
[empty summary guard check]
        ↓
[ProcessedDescription { summary, extractedLinksBlock } produced]
        ↓
[summary → CalDAV SUMMARY; extractedLinksBlock → DESCRIPTION assembly (create only)]
```

### DESCRIPTION Lifecycle (Across Syncs)

```
[Task first synced (create)]
        ↓
[DESCRIPTION = linksBlock + Obsidian Link]  ← set once
        ↓
[Task updated in Obsidian]
        ↓
[updateCalDAVTask() → property preservation]
        ↓
[DESCRIPTION preserved as-is]  ← never modified after creation
        ↓
[User changes hyperlinkSyncMode setting]
        ↓
[Next sync: SUMMARY reflects new mode on update]
[DESCRIPTION: still the original value from creation]
```

This means: if a user switches from "Keep" to "Move" after tasks are already synced, existing CalDAV tasks will get updated summaries (links stripped from SUMMARY) but the links block will NOT appear in DESCRIPTION (because DESCRIPTION is preserved from initial creation when mode was "Keep"). This is consistent with FR-009 and the property preservation contract from feature 002.

---

## Validation & Constraints

### Input Validation

| Input | Rule | Handling |
|-------|------|----------|
| `hyperlinkSyncMode` in persisted data | Must be `"keep"`, `"move"`, or `"strip"` | Invalid value → default to `"keep"` |
| Task description | Any string (including empty) | Empty description → no hyperlinks detected, no processing |
| Hyperlink display text | May be empty string | Handled: label falls back to URL in links block |
| Hyperlink URL | Must start with `http://` or `https://` | Non-http URLs not matched by regex; left untouched |

### Business Rules

1. **Mode applies at sync time only** — changing the setting does not retroactively modify CalDAV tasks
2. **DESCRIPTION is write-once** — hyperlink extraction into DESCRIPTION only occurs during task creation; updates preserve DESCRIPTION via the existing property preservation pattern
3. **Obsidian wikilinks are never processed** — `[[note]]` syntax is not matched by the hyperlink regex
4. **Bare autolinked URLs are never processed** — `https://example.com` without markdown link syntax is not matched
5. **Empty summary fallback is per-task** — if one task would have an empty summary, only that task falls back; other tasks are processed normally

### Performance Constraints

- Regex matching: O(n) per description, where n is description length. Typical task descriptions are < 200 chars. Negligible.
- String replacement: O(n × m) where m is number of hyperlinks. Typical: 1-3 links. Negligible.
- No additional network requests, disk I/O, or heavy computation.
- No in-memory structures persist beyond a single sync cycle.

---

## Summary

The feature introduces minimal data model changes:

1. **New enum**: `HyperlinkSyncMode` with three values (`keep`, `move`, `strip`)
2. **One new field**: `hyperlinkSyncMode` on `CalDAVConfiguration`
3. **Two transient types**: `MarkdownHyperlink` and `ProcessedDescription` — exist only during sync processing, never persisted
4. **Modified assembly**: `buildDescriptionWithURI()` updated to support prepending a links block
5. **No changes to**: `Task` interface, `SyncMapping`, `CalDAVTask`, `PluginData` structure (other than the one new settings field)

**Next Phase**: Define function contracts in `contracts/` and implementation guide in `quickstart.md`.

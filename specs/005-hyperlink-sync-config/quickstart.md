# Quickstart: Implementing Hyperlink Sync Configuration

**Feature**: 005-hyperlink-sync-config | **Branch**: `005-hyperlink-sync-config`

## Overview

This guide walks through implementing configurable hyperlink handling during Obsidian→CalDAV task sync. The implementation adds a new setting with three modes, a new pure-function module for hyperlink processing, and minimal modifications to the sync engine and settings UI.

**Complexity**: Low (new isolated module + small modifications to 4 existing files)
**Prerequisites**: TypeScript, familiarity with the existing sync pipeline, CalDAV test server

---

## Architecture Summary

```
Obsidian Task
     ↓
[taskToVTODO()]  →  raw summary (may contain [text](url))
     ↓
[processDescription(summary, mode)]  →  { processedSummary, extractedLinksBlock }
     ↓                                          ↓
[CalDAV SUMMARY]                    [DESCRIPTION assembly]
                                     (create path only;
                                      updates preserve DESCRIPTION)
```

**Key insight**: The hyperlink processor is a stateless transformation applied to the summary string *after* `taskToVTODO()` and *before* the CalDAV client call. It has zero knowledge of Obsidian, CalDAV, or iCalendar — just strings in, strings out.

---

## Files Changed

| File | Change |
|------|--------|
| `src/types.ts` | Add `HyperlinkSyncMode` enum + field on `CalDAVConfiguration` |
| `src/settings.ts` | Add default value for `hyperlinkSyncMode` |
| `src/sync/hyperlinkProcessor.ts` | **NEW** — extraction, transformation, formatting |
| `src/sync/engine.ts` | Call `processDescription()` in create and update paths |
| `src/ui/settingsTab.ts` | Add dropdown in Sync section |
| `src/obsidian/uriBuilder.ts` | Honour `existingContent` param in `buildDescriptionWithURI()` |

---

## Step 1: Add the Enum and Settings Field

**File**: `src/types.ts`

Add the enum before `CalDAVConfiguration`:

```typescript
/**
 * Controls how markdown hyperlinks [text](url) in task descriptions
 * are handled when syncing to CalDAV.
 */
export enum HyperlinkSyncMode {
  /** Hyperlinks remain in SUMMARY as raw markdown */
  Keep  = "keep",
  /** URLs extracted to DESCRIPTION; display text stays in SUMMARY */
  Move  = "move",
  /** URLs removed entirely; only display text remains in SUMMARY */
  Strip = "strip",
}
```

Add field to `CalDAVConfiguration`:

```typescript
export interface CalDAVConfiguration {
  // ... existing fields ...

  /** How markdown hyperlinks in task descriptions are handled during sync (default: "keep") */
  hyperlinkSyncMode: HyperlinkSyncMode;
}
```

**File**: `src/settings.ts`

Add to `DEFAULT_SETTINGS`:

```typescript
import { ..., HyperlinkSyncMode } from "./types";

export const DEFAULT_SETTINGS: CalDAVConfiguration = {
  // ... existing defaults ...

  // Hyperlink sync settings
  hyperlinkSyncMode: HyperlinkSyncMode.Keep,
};
```

---

## Step 2: Create the Hyperlink Processor Module

**File**: `src/sync/hyperlinkProcessor.ts` (new file)

This is the core of the feature. All functions are pure — no side effects, no external dependencies.

```typescript
import { HyperlinkSyncMode } from "../types";

/** A single extracted markdown hyperlink */
export interface MarkdownHyperlink {
  displayText: string;
  url: string;
  raw: string;
}

/** Output of processDescription */
export interface ProcessedDescription {
  summary: string;
  extractedLinksBlock: string;
}

// Matches [text](http(s)://url) — global flag for matchAll
const HYPERLINK_RE = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;

/** Extract all well-formed markdown hyperlinks from a string */
export function extractHyperlinks(description: string): MarkdownHyperlink[] {
  const links: MarkdownHyperlink[] = [];
  for (const match of description.matchAll(HYPERLINK_RE)) {
    links.push({
      displayText: match[1],
      url: match[2],
      raw: match[0],
    });
  }
  return links;
}

/** Replace hyperlinks with display text, normalize whitespace */
export function stripHyperlinksFromSummary(
  description: string,
  links: MarkdownHyperlink[]
): string {
  let result = description;
  for (const link of links) {
    result = result.replace(link.raw, link.displayText);
  }
  return result.replace(/\s+/g, " ").trim();
}

/** Format extracted links as a plain-text block for DESCRIPTION */
export function formatLinksBlock(links: MarkdownHyperlink[]): string {
  const lines = links.map((link) => {
    const label = link.displayText || link.url;
    return `- ${label}: ${link.url}`;
  });
  return `Links:\n${lines.join("\n")}`;
}

/**
 * Main entry point: process a description according to the active mode.
 * Never throws. Never returns an empty summary.
 */
export function processDescription(
  description: string,
  mode: HyperlinkSyncMode
): ProcessedDescription {
  if (mode === HyperlinkSyncMode.Keep) {
    return { summary: description, extractedLinksBlock: "" };
  }

  const links = extractHyperlinks(description);
  if (links.length === 0) {
    return { summary: description, extractedLinksBlock: "" };
  }

  const processedSummary = stripHyperlinksFromSummary(description, links);

  // Empty summary guard
  if (!processedSummary.trim()) {
    return { summary: description, extractedLinksBlock: "" };
  }

  const extractedLinksBlock =
    mode === HyperlinkSyncMode.Move ? formatLinksBlock(links) : "";

  return { summary: processedSummary, extractedLinksBlock };
}
```

**Verification**: This module has no imports from Obsidian or CalDAV libraries. It can be tested in isolation by simply importing and calling `processDescription()`.

---

## Step 3: Modify the Sync Engine

**File**: `src/sync/engine.ts`

**Add import** (top of file):
```typescript
import { processDescription } from "./hyperlinkProcessor";
```

**Modify `createTaskOnCalDAV()`** (around line 544):

The key changes are:
1. Call `processDescription()` on the summary after `taskToVTODO()`
2. Use `processed.summary` instead of `vtodoData.summary` when calling `client.createTask()`
3. Pass `processed.extractedLinksBlock` to `buildDescriptionWithURI()` as `existingContent`
4. If URI generation fails but we have a links block, still set `description`

```typescript
private async createTaskOnCalDAV(task: Task): Promise<void> {
  const vtodoData = taskToVTODO(task);

  // NEW: Process hyperlinks according to setting
  const processed = processDescription(vtodoData.summary, this.config.hyperlinkSyncMode);

  // Existing URI generation block (modified for links block)
  let description: string | undefined;
  try {
    const vaultName = this.vault.getName();
    if (!task.blockId) {
      console.warn('Skipping URI generation: task missing block ID');
    } else {
      const uri = buildObsidianURI(vaultName, task.filePath, task.blockId);
      // Pass extractedLinksBlock as existingContent (undefined if empty)
      description = buildDescriptionWithURI(uri, processed.extractedLinksBlock || undefined);
    }
  } catch (error) {
    console.warn(`Failed to generate Obsidian URI for task: ${error instanceof Error ? error.message : String(error)}`);
  }

  // If no URI was generated but we have extracted links, still populate description
  if (!description && processed.extractedLinksBlock) {
    description = processed.extractedLinksBlock;
  }

  // Use PROCESSED summary, not original
  const caldavTask = await this.client.createTask(
    processed.summary,
    vtodoData.due,
    vtodoData.status,
    description
  );

  // ... rest of method (mapping storage) unchanged ...
}
```

**Modify `updateCalDAVTask()`** (around line 695):

Only the summary is processed on updates. DESCRIPTION is preserved by the existing property preservation pattern.

```typescript
private async updateCalDAVTask(task: Task, mapping: SyncMapping): Promise<void> {
  // ... existing validation (unchanged) ...

  const vtodoData = taskToVTODO(task);

  // NEW: Process hyperlinks for the summary only
  const processed = processDescription(vtodoData.summary, this.config.hyperlinkSyncMode);

  const updatedTask = await this.client.updateTaskWithPreservation(
    mapping.caldavUid,
    processed.summary,      // ← processed summary
    vtodoData.due,
    vtodoData.status,
    mapping.caldavEtag,
    mapping.caldavHref
  );

  // ... mapping update unchanged ...
}
```

---

## Step 4: Update the URI Builder

**File**: `src/obsidian/uriBuilder.ts`

Modify `buildDescriptionWithURI()` to honour the `existingContent` parameter (currently stubbed out with a comment):

```typescript
export function buildDescriptionWithURI(
  uri: string,
  existingContent?: string
): string {
  if (existingContent) {
    return `${existingContent}\n\nObsidian Link: ${uri}`;
  }
  return `\n\nObsidian Link: ${uri}`;
}
```

This is a two-line change (add the `if` block, remove the two comment lines). Backward compatible — callers that don't pass `existingContent` get identical output.

---

## Step 5: Add the Settings Dropdown

**File**: `src/ui/settingsTab.ts`

**Add import** (top of file, extend existing import from types):
```typescript
import { ..., HyperlinkSyncMode } from "../types";
```

**Add dropdown** at the END of `addSyncSection()`, after the debug logging toggle (around line 194):

```typescript
// Hyperlink Sync Mode (005-hyperlink-sync-config)
new Setting(containerEl)
  .setName("Hyperlink handling")
  .setDesc("How markdown hyperlinks [text](url) in task descriptions are handled when syncing to CalDAV")
  .addDropdown((dropdown) =>
    dropdown
      .addOption(HyperlinkSyncMode.Keep,  "Keep as-is")
      .addOption(HyperlinkSyncMode.Move,  "Move to notes")
      .addOption(HyperlinkSyncMode.Strip, "Strip hyperlinks")
      .setValue(this.plugin.settings.hyperlinkSyncMode)
      .onChange(async (value) => {
        this.plugin.settings.hyperlinkSyncMode = value as HyperlinkSyncMode;
        await this.plugin.saveSettings();
      })
  );
```

No `updateSyncFilter()` call is needed — this setting is not a filter. It is read by the sync engine at processing time.

---

## Step 6: Manual Testing

### Setup
1. CalDAV test server (Nextcloud, Radicale, or iCloud)
2. Dev vault with tasks containing markdown hyperlinks
3. Hot-reload: `npm run dev`

### Test Matrix

| # | Mode | Task Description | Expected SUMMARY | Expected DESCRIPTION |
|---|------|-----------------|-----------------|---------------------|
| 1 | Keep | `Buy [milk](https://shop.com)` | `Buy [milk](https://shop.com)` | Obsidian Link only |
| 2 | Move | `Buy [milk](https://shop.com)` | `Buy milk` | `Links:\n- milk: https://shop.com\n\nObsidian Link: ...` |
| 3 | Strip | `Buy [milk](https://shop.com)` | `Buy milk` | Obsidian Link only |
| 4 | Move | `[](https://x.com) task` | `task` | `Links:\n- https://x.com: https://x.com\n\nObsidian Link: ...` |
| 5 | Strip | `[](https://x.com)` | `[](https://x.com)` (guard) | Obsidian Link only |
| 6 | Move | `No links here` | `No links here` | Obsidian Link only |
| 7 | Move | `[[wikilink]] and [ext](https://x.com)` | `[[wikilink]] and ext` | Links block + Obsidian Link |
| 8 | Strip | `Bare https://x.com url` | `Bare https://x.com url` | Obsidian Link only (bare URL untouched) |

### Scenario: Setting Change Between Syncs

1. Create task with hyperlink, setting = "Keep". Sync. Verify SUMMARY has raw markdown.
2. Change setting to "Strip". Edit task in Obsidian (e.g., add a word). Sync again.
3. Verify SUMMARY is now stripped. Verify DESCRIPTION unchanged (still just Obsidian Link from creation).

### Scenario: Coexistence with Feature 003

1. Verify that in "Move to notes" mode, the Obsidian Link still appears in DESCRIPTION and is clickable.
2. Verify the extracted links appear ABOVE the Obsidian Link.

---

## Troubleshooting

### Hyperlinks not being processed
- Verify the setting is saved: reload plugin, check Settings → Sync → Hyperlink handling
- Verify the task description contains well-formed `[text](http://...)` syntax (not `[text](relative/path)`)
- Enable debug logging and check console for any warnings

### Wikilinks being processed
- This should not happen. If it does, the regex is matching something unexpected. Check the task description for `[text](url)` that looks like a wikilink but is actually a markdown link.

### DESCRIPTION missing links block
- The links block is only written during initial task creation. If the task was created under "Keep" mode and you later switched to "Move", existing tasks will not retroactively get a links block. This is by design (FR-009).

### TypeScript errors
- `Property 'hyperlinkSyncMode' does not exist on type 'CalDAVConfiguration'` → Verify the field was added to the interface in `types.ts`
- `Cannot find module './hyperlinkProcessor'` → Verify the file path is `src/sync/hyperlinkProcessor.ts`

---

## Definition of Done

- [ ] `HyperlinkSyncMode` enum defined in `types.ts`
- [ ] `hyperlinkSyncMode` field added to `CalDAVConfiguration` with default
- [ ] `src/sync/hyperlinkProcessor.ts` created with all four functions
- [ ] `engine.ts` create path calls `processDescription()` and uses result
- [ ] `engine.ts` update path calls `processDescription()` for summary
- [ ] `uriBuilder.ts` `buildDescriptionWithURI()` prepends `existingContent`
- [ ] `settingsTab.ts` dropdown added in Sync section
- [ ] All 8 test matrix scenarios pass manually
- [ ] Setting change scenario passes
- [ ] Feature 003 coexistence scenario passes
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

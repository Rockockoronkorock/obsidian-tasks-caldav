# Research: Hyperlink Sync Behavior Configuration

**Feature**: 005-hyperlink-sync-config | **Date**: 2026-02-04

## Overview

This document consolidates research findings for implementing configurable hyperlink handling during Obsidian→CalDAV task sync. All technical unknowns were resolved through codebase exploration of the existing sync pipeline, DESCRIPTION field usage (feature 003), and settings infrastructure.

---

## Decision 1: Hyperlink Detection — Regex Scope and Strategy

**Decision**: Use a single regex pass over the task description to detect well-formed markdown hyperlinks with `http://` or `https://` URLs only:

```
/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g
```

This matches: `[display text](http://... or https://...)` including empty display text `[](url)`.

**Rationale**:
- The spec explicitly scopes "hyperlinks in the Markdown format" to standard inline links `[text](url)`. Obsidian wikilinks `[[note]]`, bare autolinked URLs, and relative links are out of scope.
- Restricting to `http(s)://` URLs avoids false positives on relative paths, `mailto:`, `tel:`, or other non-web URI schemes that share the markdown link syntax.
- A single global-flag regex pass is O(n) per description — negligible cost even for long descriptions.
- The existing codebase uses regex for CalDAV property extraction (e.g., `vtodo.ts` SUMMARY/DUE/STATUS parsing); this pattern is consistent.

**Alternatives Considered**:
1. **Full markdown parser (e.g., remark)** — Rejected. Adds a dependency for a one-regex job. Constitution Principle IV (bundle size) and the existing codebase's preference for lightweight string operations both argue against it.
2. **Also match relative links `[text](path/to/file)`** — Rejected. Relative links are not hyperlinks in the user's mental model and would produce confusing entries in the Notes section.
3. **Match all URI schemes `[text](anything)`** — Rejected. Too broad; would match image embeds, file references, etc.

**Edge Cases Handled by Regex**:
- Empty display text: `[](https://example.com)` — captured; display text is empty string
- Display text with special chars: `[foo & bar](https://...)` — captured correctly
- Parentheses in URL: `[text](https://en.wikipedia.org/wiki/Foo_(bar))` — the regex stops at the first `)`, which may truncate. This is a known markdown parser limitation shared by most lightweight parsers. Accepted as an edge case; users with Wikipedia-style URLs can use the "Keep as-is" mode.
- Nested brackets: `[[wikilink]](url)` — the inner `[` breaks the `[^\]]*` group, so this is NOT matched. Correct — wikilinks are out of scope.

---

## Decision 2: DESCRIPTION Field Layout — Coexistence with Obsidian Link (Feature 003)

**Decision**: When "Move to Notes" mode extracts hyperlinks, format them as a labeled block placed **before** the existing Obsidian Link content in the DESCRIPTION field:

```
Links:
- display text: https://example.com
- another link: https://other.com

Obsidian Link: obsidian://open?vault=...
```

**Rationale**:
- Feature 003 sets `DESCRIPTION` to `\n\nObsidian Link: {uri}` during initial task creation and **never modifies it again** (property preservation). This feature's hyperlink extraction also only runs at creation time (the summary is what gets synced on updates; DESCRIPTION is preserved).
- Placing extracted hyperlinks **above** the Obsidian Link keeps the Obsidian Link at the bottom (where 003 placed it), minimizing visual disruption for users who already rely on that placement.
- The "Links:" label makes the section scannable in CalDAV clients that render DESCRIPTION as plain text.
- Each link is formatted as `- display text: URL` (plain text list) rather than markdown, because CalDAV clients vary widely in markdown rendering support. Plain text is universally readable.

**Alternatives Considered**:
1. **Below the Obsidian Link** — Rejected. Would require parsing out and re-appending the Obsidian Link, adding fragility.
2. **Markdown link syntax in DESCRIPTION (`[text](url)`)** — Rejected. Most CalDAV clients do not render markdown in DESCRIPTION fields. Plain text is safer.
3. **Separate custom iCalendar property (e.g., `X-OBSIDIAN-LINKS`)** — Rejected. Non-standard properties are invisible in most CalDAV clients. DESCRIPTION is the only widely-displayed free-text field.

**Integration with `buildDescriptionWithURI()`**:
- The existing function in `uriBuilder.ts` (line 90-97) currently ignores its `existingContent` parameter and always returns `\n\nObsidian Link: {uri}`.
- The hyperlink processor will produce a "links block" string (or empty string if no links extracted).
- The sync engine will pass this links block as `existingContent` to `buildDescriptionWithURI()`, which must be updated to prepend it when non-empty.
- This keeps the responsibility boundary clean: `hyperlinkProcessor` extracts and formats links; `uriBuilder` assembles the final DESCRIPTION.

---

## Decision 3: Processing Location in the Sync Pipeline

**Decision**: Apply hyperlink processing in `SyncEngine.createTaskOnCalDAV()` (line 544) and `SyncEngine.updateCalDAVTask()` (line 695), immediately after `taskToVTODO()` produces the summary, and before the summary is sent to the CalDAV client.

**Rationale**:
- `createTaskOnCalDAV()` is the sole path for new task creation. The summary that reaches CalDAV originates from `taskToVTODO(task)` which returns `task.description` as-is.
- `updateCalDAVTask()` feeds `vtodoData.summary` into `updateTaskWithPreservation()`. If the user edits a task in Obsidian and the hyperlink setting is active, the updated summary on CalDAV should reflect the current setting.
- Processing at the sync engine level keeps the CalDAV client and VTODO utilities agnostic to hyperlink handling. The processor is a transformation applied to the summary string before it enters the CalDAV layer.
- The setting value is read from `this.config` which is already available on the engine.

**Why not in `taskToVTODO()`?**
- `taskToVTODO()` is a pure conversion function with no access to settings. Adding a config dependency would violate its single responsibility.

**Why not in the CalDAV client?**
- The client is a transport layer. Business logic (hyperlink policy) belongs in the sync engine.

**Processing flow for create:**
```
task.description
  → taskToVTODO() → vtodoData.summary (raw, with hyperlinks)
  → hyperlinkProcessor.processDescription(summary, mode)
      → { processedSummary, extractedLinksBlock }
  → if mode == "Move to Notes": pass extractedLinksBlock as existingContent to buildDescriptionWithURI()
  → client.createTask(processedSummary, fullDescription)
```

**Processing flow for update (property preservation path):**
```
task.description
  → taskToVTODO() → vtodoData.summary
  → hyperlinkProcessor.processDescription(summary, mode)
      → { processedSummary }  // extractedLinksBlock ignored on updates (DESCRIPTION preserved)
  → client.updateTaskWithPreservation(processedSummary, ...)
```

Note: On updates, only the summary is transformed. DESCRIPTION is preserved by the property preservation pattern (feature 002). This means hyperlinks moved to Notes on creation stay there; hyperlinks added to a task after initial sync will be processed according to the current setting on the next summary update, but the Notes section won't be re-populated (it's preserved as-is). This is consistent with FR-009 (setting applies at sync time, no retroactive modification).

---

## Decision 4: Empty Summary Guard

**Decision**: After hyperlink processing, if the resulting summary is empty or whitespace-only, fall back to the original unprocessed description.

**Rationale**:
- FR-008 is explicit: the system MUST NOT produce an empty task summary.
- Edge case: a task description that is *only* a hyperlink, e.g., `- [ ] [click here](https://example.com)`. In "Strip" mode, this becomes just "click here" (non-empty, fine). But `- [ ] [](https://example.com)` with empty display text would become just whitespace after stripping.
- The guard is a single `if` check after processing: `if (!processed.trim()) return original`.
- This is a safety net; it should rarely trigger in practice.

**Alternatives Considered**:
1. **Block the setting change if any current task would become empty** — Rejected. Overly complex, requires scanning all tasks on settings change.
2. **Replace empty summary with a placeholder like "[link]"** — Rejected. Fabricating content is worse than preserving the original.

---

## Decision 5: Setting Persistence and Default

**Decision**: Add `hyperlinkSyncMode` as a string enum field on `CalDAVConfiguration` with default value `"keep"`. Persist via the existing plugin `data.json` settings mechanism (same as all other settings).

**Rationale**:
- All existing settings use `CalDAVConfiguration` + `DEFAULT_SETTINGS` + `plugin.saveSettings()`. This is the established pattern; deviating would be inconsistent.
- The enum values are short identifiers: `"keep"`, `"move"`, `"strip"`. These map to the three modes from the spec.
- Default `"keep"` ensures backward compatibility (FR-010): existing users who upgrade see no behavior change until they explicitly change the setting.
- A TypeScript `enum` or string literal union type provides compile-time safety.

**Enum definition:**
```typescript
export enum HyperlinkSyncMode {
  Keep = "keep",        // Keep as-is in SUMMARY
  Move = "move",        // Move to DESCRIPTION/Notes
  Strip = "strip",      // Strip URLs, keep display text only
}
```

---

## Decision 6: Settings UI — Dropdown in Sync Section

**Decision**: Add a dropdown (`Setting.addDropdown()`) in the existing "Sync" section of `settingsTab.ts`, after the debug logging toggle.

**Rationale**:
- The setting governs sync behavior, not filtering. It belongs in the "Sync" section alongside auto-sync and debug logging.
- A dropdown is the right control for a single-select enum with 3 options. Obsidian's `Setting.addDropdown()` is the established pattern (used elsewhere in the Obsidian ecosystem).
- Label: "Hyperlink handling" (sentence case per Constitution Principle V). Description explains the three options briefly.
- No restart required — the setting takes effect on the next sync (FR-009).

---

## Decision 7: Testing Strategy

**Decision**: Manual testing in a dev vault. No new automated test infrastructure (consistent with the project's current approach).

**Rationale**:
- The project has no automated test suite for plugin logic (only linting via `eslint-plugin-obsidianmd`).
- The hyperlink processor functions are pure and could be unit tested, but adding a test runner (jest/vitest) is scope creep for this feature.
- Manual test scenarios cover all three modes × key edge cases. See quickstart.md for the test matrix.

**Test coverage targets**:
- Each mode with a single hyperlink
- Each mode with multiple hyperlinks
- Each mode with no hyperlinks (no-op)
- Empty display text edge case
- Summary-becomes-empty guard
- Setting change between syncs
- Coexistence with Obsidian Link in DESCRIPTION

---

## Summary of Resolved Unknowns

| Unknown | Resolution |
|---------|------------|
| Which link syntax to target | Standard markdown `[text](http(s)://url)` only |
| How to coexist with feature 003 DESCRIPTION | Prepend links block above Obsidian Link |
| Where in the pipeline to process | Sync engine, after `taskToVTODO()`, before CalDAV client |
| How to handle empty summary | Fall back to original description |
| How to persist the setting | Existing `CalDAVConfiguration` + `data.json` pattern |
| Where in the UI | Dropdown in "Sync" section |
| Testing approach | Manual, consistent with project norms |

**No new dependencies required.** All processing uses built-in JavaScript regex and string operations.

---
description: "Task list for 005-hyperlink-sync-config"
---

# Tasks: Hyperlink Sync Behavior Configuration

**Input**: Design documents from `/specs/005-hyperlink-sync-config/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not included. research.md Decision 7 confirms manual-only testing strategy (no automated test runner in this project). Test scenarios are covered in the Polish phase via the quickstart.md test matrix.

**Organization**: Tasks are grouped by user story. US1 (Keep as-is) is the MVP — it gates the dropdown UI and the engine integration. US2 and US3 add the move and strip behaviours on top.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Types & Defaults)

**Purpose**: Add the enum and the settings field that every subsequent phase depends on. Two independent files — both can land in parallel.

- [X] T001 [P] Add `HyperlinkSyncMode` enum to `src/types.ts` and add `hyperlinkSyncMode: HyperlinkSyncMode` field to the `CalDAVConfiguration` interface (see contracts/hyperlinkProcessor.ts types section and data-model.md "Configuration Extension")
- [X] T002 [P] Import `HyperlinkSyncMode` in `src/settings.ts` and add `hyperlinkSyncMode: HyperlinkSyncMode.Keep` to `DEFAULT_SETTINGS` (see quickstart.md Step 1)

**Checkpoint**: Enum and default defined. TypeScript should compile with the new field present on `CalDAVConfiguration`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The core hyperlink processor module and the URI builder fix. Both must be complete before any user story wiring can happen. These two tasks touch different files and can run in parallel.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `src/sync/hyperlinkProcessor.ts` with all four exported functions (`extractHyperlinks`, `stripHyperlinksFromSummary`, `formatLinksBlock`, `processDescription`), the `MARKDOWN_HYPERLINK_REGEX` constant, and the two exported interfaces (`MarkdownHyperlink`, `ProcessedDescription`). Follow the full implementation in quickstart.md Step 2 — every function body is specified there. The module must have zero imports from Obsidian or CalDAV; its only import is `HyperlinkSyncMode` from `../types`.
- [X] T004 [P] Update `buildDescriptionWithURI()` in `src/obsidian/uriBuilder.ts` to honour the existing `existingContent` parameter: add an `if (existingContent)` branch that returns `` `${existingContent}\n\nObsidian Link: ${uri}` ``, and remove the two stub comment lines ("For initial implementation…" / "Future enhancement…"). See contracts/uriBuilder.ts for exact before/after. Callers that omit `existingContent` must get identical output to today.

**Checkpoint**: Foundation ready — `processDescription()` exists and handles all three modes; `buildDescriptionWithURI()` can prepend a links block. User story implementation can now begin.

---

## Phase 3: User Story 1 — Keep Hyperlinks Visible in Task Summary (Priority: P1) 🎯 MVP

**Goal**: Wire the "Keep as-is" mode end-to-end. A user who leaves the default setting sees zero behaviour change. The settings dropdown exists and persists.

**Independent Test**: Create a task in Obsidian containing `[text](https://url)`, leave the setting at the default "Keep as-is", sync to CalDAV, and verify the CalDAV SUMMARY contains the raw markdown hyperlink unchanged.

### Implementation for User Story 1

- [X] T005 [P] [US1] Add the hyperlink-handling dropdown to `src/ui/settingsTab.ts`: import `HyperlinkSyncMode` from `../types`, then append the `new Setting(containerEl)` block (`.setName("Hyperlink handling")`, `.addDropdown(…)` with three options) at the end of `addSyncSection()`, after the debug-logging toggle. See contracts/settingsTab.ts and quickstart.md Step 5 for the exact code block.
- [X] T006 [P] [US1] Integrate `processDescription` into the **create path** of `src/sync/engine.ts`: add `import { processDescription } from "./hyperlinkProcessor"` at the top, then in `createTaskOnCalDAV()` call `processDescription(vtodoData.summary, this.config.hyperlinkSyncMode)` immediately after `taskToVTODO()`, and pass `processed.summary` (not `vtodoData.summary`) to `client.createTask()`. For now, pass `processed.extractedLinksBlock || undefined` as the second argument to `buildDescriptionWithURI()` — this is a no-op in Keep mode (the block is always `""`), but the plumbing must be in place. See contracts/syncEngine.ts "createTaskOnCalDAV" section and quickstart.md Step 3.
- [X] T007 [US1] Integrate `processDescription` into the **update path** of `src/sync/engine.ts`: in `updateCalDAVTask()`, call `processDescription(vtodoData.summary, this.config.hyperlinkSyncMode)` after `taskToVTODO()` and pass `processed.summary` to `updateTaskWithPreservation()` instead of `vtodoData.summary`. `extractedLinksBlock` is intentionally ignored here (DESCRIPTION is preserved by feature 002). See contracts/syncEngine.ts "updateCalDAVTask" section.

**Checkpoint**: US1 is fully functional. Default "Keep as-is" mode preserves existing sync behaviour. The dropdown is visible and persists. Create and update paths both route through `processDescription`.

---

## Phase 4: User Story 2 — Move Hyperlinks to Notes Section (Priority: P2)

**Goal**: When the user selects "Move to notes", extracted hyperlinks appear in the CalDAV DESCRIPTION above the Obsidian Link, and the SUMMARY shows only display text.

**Independent Test**: Create a task with one or more `[text](url)` hyperlinks, set the mode to "Move to notes", sync, and verify the CalDAV SUMMARY contains only the display text while the Notes/DESCRIPTION contains a `Links:` block above the Obsidian Link. Also verify a task with no hyperlinks is unaffected.

### Implementation for User Story 2

- [X] T008 [US2] Complete the `extractedLinksBlock` → DESCRIPTION assembly in the **create path** of `src/sync/engine.ts`: ensure that when `processed.extractedLinksBlock` is non-empty (which happens when mode is "move" and links were found), it is passed through to `buildDescriptionWithURI()` as `existingContent`. Additionally, add the fallback: if no Obsidian URI was generated (the try-catch failed or `blockId` is missing) but `extractedLinksBlock` is non-empty, set `description = processed.extractedLinksBlock` so links are not silently lost. Verify the plumbing installed in T006 covers both branches — the only new logic here is the URI-less fallback. See contracts/syncEngine.ts lines 77–80 and quickstart.md Step 3.
- [ ] T009 [US2] Manually verify the "Move to notes" flow against test matrix rows 2, 4, 6, and 7 from quickstart.md: (2) single hyperlink moved correctly, (4) empty-display-text hyperlink uses URL as label, (6) no-hyperlink task is unaffected, (7) wikilink coexists with extracted markdown link. Confirm the Links block appears above the Obsidian Link in DESCRIPTION.

**Checkpoint**: US2 is fully functional. "Move to notes" extracts links into DESCRIPTION, coexists with the Obsidian Link from feature 003, and handles all edge cases from the spec.

---

## Phase 5: User Story 3 — Strip Hyperlinks Entirely (Priority: P3)

**Goal**: When the user selects "Strip hyperlinks", URLs are removed from SUMMARY and discarded entirely — nothing is added to DESCRIPTION.

**Independent Test**: Create a task with hyperlinks, set the mode to "Strip hyperlinks", sync, and verify the CalDAV SUMMARY contains only the display text and the DESCRIPTION contains no Links block (only the Obsidian Link if present). Verify the empty-summary guard: a task whose description is only `[](https://url)` keeps its original description unchanged.

### Implementation for User Story 3

- [X] T010 [US3] Confirm that the "strip" path requires no additional code changes beyond what was wired in Phases 2–4. In `processDescription`, when `mode === HyperlinkSyncMode.Strip`, `stripHyperlinksFromSummary` is called (foundational, T003) and `extractedLinksBlock` is returned as `""` — so the engine create path passes `undefined` as `existingContent` to `buildDescriptionWithURI()` (existing wiring from T006), and the update path passes only the processed summary (T007). Read through `src/sync/hyperlinkProcessor.ts` and `src/sync/engine.ts` to confirm the strip path is complete and no new code is needed. If any gap is found, close it.
- [ ] T011 [US3] Manually verify the "Strip hyperlinks" flow against test matrix rows 3, 5, and 8 from quickstart.md: (3) single hyperlink stripped to display text, (5) empty-display-text-only task triggers the empty-summary guard and keeps the original description, (8) bare URL without markdown syntax is left untouched.

**Checkpoint**: All three user stories are independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Build validation, lint, and end-to-end manual regression across all modes.

- [X] T012 [P] Run `npm run build` from the repository root and confirm it succeeds with zero errors. Fix any TypeScript errors if present.
- [X] T013 [P] Run `npm run lint` from the repository root and confirm it passes. Fix any lint warnings or errors if present.
- [ ] T014 Run the full 8-row test matrix from quickstart.md Step 6 against a CalDAV test server (Nextcloud, Radicale, or iCloud) in a dev vault with hot-reload. Record pass/fail for each row.
- [ ] T015 Run the "Setting Change Between Syncs" scenario from quickstart.md Step 6: create under "Keep", change to "Strip", edit and re-sync, confirm SUMMARY is stripped and DESCRIPTION is unchanged from creation.
- [ ] T016 Run the "Coexistence with Feature 003" scenario from quickstart.md Step 6: confirm the Obsidian Link remains present and clickable in DESCRIPTION across all three modes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T001 and T002 are parallel.
- **Foundational (Phase 2)**: Depends on Phase 1 completion (needs the enum). T003 and T004 are parallel.
- **User Stories (Phase 3–5)**: All depend on Phase 2 completion.
  - Phase 3 (US1) must complete before Phase 4 (US2) — US2's DESCRIPTION assembly builds on the create-path plumbing installed in T006.
  - Phase 5 (US3) can start after Phase 3 completes (the strip path is a subset of the wiring already in place).
  - Phase 4 and Phase 5 can run in parallel once Phase 3 is done.
- **Polish (Phase 6)**: Depends on all user story phases completing.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Phase 2. No dependencies on other stories. Installs the engine plumbing that US2 and US3 extend.
- **User Story 2 (P2)**: Starts after US1 (Phase 3) is complete. Adds the DESCRIPTION assembly and the URI-less fallback on top of T006's plumbing.
- **User Story 3 (P3)**: Starts after US1 (Phase 3) is complete. Requires no new code — just verification that the strip path through the existing wiring is correct.

### Within Each User Story

- Models/types before services (Phase 1 before Phase 2)
- Core module before engine integration (Phase 2 before Phase 3)
- Create path before update path within US1 (T006 before T007) — same file, sequential
- UI dropdown (T005) and create-path wiring (T006) are in different files and can run in parallel within US1

### Parallel Opportunities

- **Phase 1**: T001 ∥ T002 (types.ts vs settings.ts)
- **Phase 2**: T003 ∥ T004 (hyperlinkProcessor.ts vs uriBuilder.ts)
- **Phase 3 (US1)**: T005 ∥ T006 (settingsTab.ts vs engine.ts) → then T007 sequentially (same file as T006)
- **Phase 4 + Phase 5**: Can run in parallel once Phase 3 is complete
- **Phase 6**: T012 ∥ T013 (build vs lint — independent commands)

---

## Parallel Example: Phase 1

```
Task T001: Add HyperlinkSyncMode enum + field in src/types.ts
Task T002: Add default for hyperlinkSyncMode in src/settings.ts
```

## Parallel Example: Phase 2

```
Task T003: Create src/sync/hyperlinkProcessor.ts (new module)
Task T004: Update buildDescriptionWithURI() in src/obsidian/uriBuilder.ts
```

## Parallel Example: User Story 1 (Phase 3)

```
Task T005: Add dropdown in src/ui/settingsTab.ts
Task T006: Wire processDescription in create path of src/sync/engine.ts
→ then T007 (update path, same file as T006)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Foundational (T003, T004) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T005, T006, T007)
4. **STOP and VALIDATE**: Sync a task with a hyperlink under "Keep as-is". Confirm no behaviour change from before this feature.
5. Ship if only the default mode is needed.

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. User Story 1 → Default "Keep" mode works → MVP
3. User Story 2 → "Move to notes" works → second release
4. User Story 3 → "Strip hyperlinks" works → third release (often a no-code delta; just verify)
5. Polish → full regression across all modes

### Parallel Team Strategy

With multiple developers after Phase 2 is done:

- Developer A: User Story 1 (T005, T006, T007)
- Once US1 lands:
  - Developer A: User Story 2 (T008, T009)
  - Developer B: User Story 3 (T010, T011)
- Polish: single developer runs the test matrix

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps task to a specific user story for traceability
- Tests are not included; manual verification tasks (T009, T011, T014–T016) cover the quickstart.md test matrix
- Each user story checkpoint is a valid stopping point for incremental delivery
- Total new code: ~60 lines (hyperlinkProcessor.ts) + ~25 lines across 4 modified files
- No new dependencies introduced

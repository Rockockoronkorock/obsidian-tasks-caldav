# Implementation Plan: Hyperlink Sync Behavior Configuration

**Branch**: `005-hyperlink-sync-config` | **Date**: 2026-02-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-hyperlink-sync-config/spec.md`

## Summary

Add a user-configurable setting ("Keep as-is" / "Move to notes" / "Strip hyperlinks") that controls how standard markdown hyperlinks `[text](url)` in task descriptions are handled when syncing from Obsidian to CalDAV. The implementation adds a new pure-function module for hyperlink extraction and transformation, integrates it into the existing sync engine's create and update paths, and exposes the setting via a dropdown in the Sync section of the settings tab. The feature coexists with the Obsidian Link in DESCRIPTION (feature 003) by prepending extracted links above it. Default is "Keep as-is" for backward compatibility.

## Technical Context

**Language/Version**: TypeScript 5.8.3 with strict mode, targeting Obsidian API ^1.11.4
**Primary Dependencies**: Obsidian API, tsdav (^2.0.6) CalDAV client library — no new dependencies added
**Storage**: Plugin data.json (settings + sync mappings), Obsidian vault markdown files (.md)
**Testing**: Manual testing via hot-reload in dev vault, linting via eslint-plugin-obsidianmd
**Target Platform**: Obsidian Desktop and Mobile (cross-platform via Obsidian API)
**Project Type**: Single Obsidian plugin with modular TypeScript architecture
**Performance Goals**: <1ms per task for hyperlink processing; no additional network or disk I/O
**Constraints**: Must not break existing bidirectional sync or feature 003 DESCRIPTION content; default setting preserves current behavior; no new dependencies
**Scale/Scope**: Single setting, one new module (~60 lines), modifications to 4 existing files (~25 lines total added)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Modularity & Code Organization
✅ **PASS**: New functionality is isolated in `src/sync/hyperlinkProcessor.ts` (~60 lines, single responsibility: hyperlink extraction and transformation). Modifications to existing files are minimal and focused: `engine.ts` (~11 lines added), `settingsTab.ts` (~13 lines added), `uriBuilder.ts` (~3 lines changed), `types.ts` + `settings.ts` (~8 lines added). No file approaches the 200-300 line limit. `main.ts` is untouched.

### Principle II: Security & Privacy First
✅ **PASS**: All processing is local string manipulation. No network requests, no telemetry, no external service calls. The hyperlink processor reads URLs from task descriptions that are already in the vault — no new data access. No remote code execution. Vault access scope is unchanged.

### Principle III: Versioning & API Stability
✅ **PASS**: No changes to plugin ID or command IDs. The new `hyperlinkSyncMode` field on `CalDAVConfiguration` defaults to `"keep"`, making the change invisible to existing users. Settings serialization is backward compatible — existing `data.json` files without the field will get the default on next load. No protocol deviations from RFC 5545.

### Principle IV: Performance & Resource Efficiency
✅ **PASS**: Hyperlink processing is <1ms per task (one regex pass + string replacements on typical <200 char descriptions). No disk I/O, no network requests, no heavy initialization. No in-memory structures persist beyond a single sync cycle. No impact on startup time or mobile performance.

### Principle V: Obsidian Policy Compliance
✅ **PASS**: Settings UI uses Obsidian's `Setting.addDropdown()` with sentence-case labels. No deceptive patterns, ads, or spammy notifications. TypeScript strict mode maintained. Error handling follows existing patterns.

**Result**: All constitution checks pass. No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/005-hyperlink-sync-config/
├── plan.md                        # This file
├── spec.md                        # Feature specification
├── research.md                    # Phase 0 output — technical decisions
├── data-model.md                  # Phase 1 output — entities and transformations
├── quickstart.md                  # Phase 1 output — implementation guide
├── contracts/                     # Phase 1 output — API contracts
│   ├── hyperlinkProcessor.ts      # New module contract
│   ├── syncEngine.ts              # Sync engine integration contract
│   ├── settingsTab.ts             # Settings UI contract
│   └── uriBuilder.ts              # URI builder modification contract
└── checklists/
    └── requirements.md            # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── sync/
│   ├── hyperlinkProcessor.ts      # NEW: Hyperlink extraction and transformation
│   └── engine.ts                  # MODIFIED: Integrate processDescription() in create + update
├── ui/
│   └── settingsTab.ts             # MODIFIED: Add hyperlink mode dropdown in Sync section
├── obsidian/
│   └── uriBuilder.ts              # MODIFIED: Honour existingContent in buildDescriptionWithURI()
├── types.ts                       # MODIFIED: Add HyperlinkSyncMode enum + field
└── settings.ts                    # MODIFIED: Add default for hyperlinkSyncMode
```

**Structure Decision**: Single Obsidian plugin project following existing modular architecture. The new `hyperlinkProcessor.ts` lives in `src/sync/` alongside `engine.ts` and `filters.ts` because it is a sync-time transformation — conceptually parallel to filtering. No new directories required.

## Complexity Tracking

N/A — No constitution violations detected.

---

## Phase 0: Research — COMPLETED ✓

**Output**: `research.md`

**Key Findings**:
1. **Hyperlink regex**: `/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g` — matches well-formed markdown hyperlinks with http(s) URLs only. Wikilinks, bare URLs, and relative links are explicitly excluded.
2. **DESCRIPTION coexistence**: Extracted links block is prepended above the existing Obsidian Link (feature 003). Format: plain-text `Links:\n- label: url` block.
3. **Processing location**: Sync engine, after `taskToVTODO()`, before CalDAV client calls. Both create and update paths.
4. **Empty summary guard**: If processing would produce an empty summary, fall back to original description unchanged.
5. **Setting persistence**: Standard `CalDAVConfiguration` field + `data.json`. Default `"keep"` for backward compatibility.
6. **Settings UI**: `Setting.addDropdown()` in Sync section, after debug logging toggle.
7. **No new dependencies**: All processing uses built-in JS regex and string operations.
8. **`buildDescriptionWithURI()` stub**: The existing function in `uriBuilder.ts` already has an `existingContent` parameter that is currently ignored — this feature completes that stub.

**Unknowns Resolved**: All technical unknowns resolved through codebase exploration. No NEEDS CLARIFICATION items remain.

---

## Phase 1: Design & Contracts — COMPLETED ✓

**Outputs**:
- `data-model.md`: Entities (`HyperlinkSyncMode`, `MarkdownHyperlink`, `ProcessedDescription`), transformations, state models
- `contracts/hyperlinkProcessor.ts`: New module — types, regex, four functions, test scenarios
- `contracts/syncEngine.ts`: Create + update path modifications, error handling, performance
- `contracts/settingsTab.ts`: Dropdown placement, options, UI copy
- `contracts/uriBuilder.ts`: `buildDescriptionWithURI()` modification — completing the existing stub
- `quickstart.md`: Step-by-step implementation guide with code samples and test matrix

**Design Decisions**:
1. **New Module** (`src/sync/hyperlinkProcessor.ts`, ~60 lines):
   - Four pure functions: `extractHyperlinks()`, `stripHyperlinksFromSummary()`, `formatLinksBlock()`, `processDescription()`
   - Zero dependencies on Obsidian API or CalDAV libraries
   - `processDescription()` is the single entry point — never throws, never returns empty summary

2. **Minimal Modifications**:
   - `engine.ts`: +8 lines in create path, +3 lines in update path (processDescription call + use result)
   - `settingsTab.ts`: +13 lines (dropdown in Sync section)
   - `uriBuilder.ts`: +3/-2 lines (honour existingContent param — completing existing TODO)
   - `types.ts` + `settings.ts`: +8 lines (enum + field + default)

3. **Data Flow (Create)**:
   ```
   task.description → taskToVTODO() → summary
     → processDescription(summary, mode) → { processedSummary, extractedLinksBlock }
     → processedSummary → CalDAV SUMMARY
     → extractedLinksBlock + Obsidian URI → buildDescriptionWithURI() → CalDAV DESCRIPTION
   ```

4. **Data Flow (Update)**:
   ```
   task.description → taskToVTODO() → summary
     → processDescription(summary, mode) → { processedSummary }
     → processedSummary → updateTaskWithPreservation() → CalDAV SUMMARY
     (DESCRIPTION preserved by property preservation — unchanged)
   ```

5. **Empty Summary Guard**: Implemented inside `processDescription()` — if the processed summary is empty or whitespace-only, the function returns the original description unchanged with an empty links block.

**Architecture Validation**:
- ✅ Modular design: new module has single responsibility, zero external dependencies
- ✅ Backward compatible: default "keep" mode = no behavior change; `existingContent` param was already in the signature
- ✅ Leverages existing patterns: property preservation (002), DESCRIPTION assembly (003), settings infrastructure
- ✅ No breaking changes to any existing APIs or sync behavior
- ✅ Minimal code changes (~95 lines total across 6 files, ~60 of which are the new module)

---

## Constitution Re-Check (Post-Design)

*Re-evaluating constitution compliance after Phase 1 design.*

### Principle I: Modularity & Code Organization
✅ **PASS**: Design confirms modularity. `hyperlinkProcessor.ts` is <100 lines with single responsibility. All modifications to existing files are focused and minimal. No file approaches size limits. Module boundaries are clear: processor handles text transformation; engine handles orchestration; client handles transport.

### Principle II: Security & Privacy First
✅ **PASS**: Design confirms security. All operations are local string manipulation. No network calls, no telemetry, no new vault access. URLs in task descriptions are already user-authored content in the vault — the processor merely rearranges them within the sync output.

### Principle III: Versioning & API Stability
✅ **PASS**: Design confirms API stability. New setting defaults to "keep" — zero behavior change for existing users. `CalDAVConfiguration` gains one optional-in-practice field. `buildDescriptionWithURI()` signature is unchanged (parameter already existed). No breaking changes.

### Principle IV: Performance & Resource Efficiency
✅ **PASS**: Design confirms performance. Regex + string replace: <1ms per task. No heavy computation, no disk I/O, no network overhead. `processDescription()` allocates one array and a few strings per call — trivial GC pressure.

### Principle V: Obsidian Policy Compliance
✅ **PASS**: Design confirms policy compliance. Dropdown uses Obsidian `Setting` API correctly. Labels are sentence case. Description text is clear and concise. No policy violations.

**Final Result**: All constitution checks pass after Phase 1 design. No violations. Proceed to implementation via `/speckit.tasks`.

---

## Implementation Readiness

**Status**: Ready for implementation ✓

**Next Command**: `/speckit.tasks` — Generate actionable tasks.md with dependency-ordered implementation steps.

**Required Resources**:
- CalDAV test server (Nextcloud, Radicale, or iCloud)
- Dev vault with test tasks containing markdown hyperlinks
- Hot-reload setup (`npm run dev`)

**Success Criteria** (from spec.md):
- 100% of well-formed markdown hyperlinks correctly processed per selected mode
- Users can change mode and see effect on next sync without restart
- "Move to notes" produces shorter summaries than raw markdown
- Existing Obsidian Link content in DESCRIPTION remains intact across all modes
- Zero empty task summaries produced by hyperlink processing

---

## Artifacts Generated

```text
specs/005-hyperlink-sync-config/
├── plan.md                        ✓ This file (complete)
├── spec.md                        ✓ Feature specification (from /speckit.specify)
├── research.md                    ✓ Phase 0 output (technical decisions)
├── data-model.md                  ✓ Phase 1 output (entities and transformations)
├── quickstart.md                  ✓ Phase 1 output (implementation guide)
├── contracts/                     ✓ Phase 1 output (API contracts)
│   ├── hyperlinkProcessor.ts      ✓ New module contract
│   ├── syncEngine.ts              ✓ Sync engine integration
│   ├── settingsTab.ts             ✓ Settings UI
│   └── uriBuilder.ts              ✓ URI builder modification
└── checklists/
    └── requirements.md            ✓ Spec quality checklist (from /speckit.specify)
```

**Agent Context Updated**: ✓ CLAUDE.md updated

**Phase 2**: Ready for `/speckit.tasks` command to generate implementation tasks.

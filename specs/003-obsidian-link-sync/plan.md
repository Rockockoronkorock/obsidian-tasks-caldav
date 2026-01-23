# Implementation Plan: Obsidian Link Sync to CalDAV

**Branch**: `003-obsidian-link-sync` | **Date**: 2026-01-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-obsidian-link-sync/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable users to access Obsidian task context directly from CalDAV clients by appending clickable Obsidian URIs to the DESCRIPTION field during initial task sync. The implementation extends the existing bidirectional CalDAV sync by generating `obsidian://open?vault=...&file=...&block=...` URIs during task creation, leveraging the existing property preservation pattern to maintain URIs across subsequent syncs. This is a one-way enrichment feature (Obsidian→CalDAV only) that enhances cross-platform workflows without modifying the core sync logic.

## Technical Context

**Language/Version**: TypeScript 5.8.3 with strict mode, targeting Obsidian API (latest)
**Primary Dependencies**: Obsidian API, txml (XML parser), built-in HTTP client
**Storage**: Obsidian vault files (.md), plugin data.json (sync state/mappings)
**Testing**: Manual testing via hot-reload in dev vault, linting via eslint-plugin-obsidianmd
**Target Platform**: Obsidian Desktop and Mobile (cross-platform via Obsidian API)
**Project Type**: Single Obsidian plugin with modular TypeScript architecture
**Performance Goals**: Negligible impact on sync performance (<5ms per task for URI generation)
**Constraints**: Must not break existing bidirectional sync, read-only to DESCRIPTION field after initial sync, no network calls beyond existing CalDAV sync
**Scale/Scope**: Handles vaults with 100-1000+ tasks, file paths up to ~260 chars, vault names up to ~50 chars

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Modularity & Code Organization
✅ **PASS**: Feature will be implemented in a new module `src/obsidian/uriBuilder.ts` (~50 lines) with single responsibility (URI generation). Changes to existing modules are minimal and focused: `sync/engine.ts` (~10 lines for integration), `caldav/client.ts` (~5 lines for DESCRIPTION parameter), `caldav/vtodo.ts` (no changes needed - property preservation already handles DESCRIPTION). No file exceeds size limits.

### Principle II: Security & Privacy First
✅ **PASS**: Feature operates entirely locally with no network requests beyond existing CalDAV sync. URIs are generated from local vault metadata (vault name, file paths, block IDs) without external dependencies or data leakage. No telemetry, no remote execution, no additional vault access beyond what the plugin already requires for task scanning. URIs point to local vault content only.

### Principle III: Versioning & API Stability
✅ **PASS**: No changes to plugin ID, command IDs, or public API. Feature is an internal enhancement to existing sync behavior. No breaking changes to manifest or command structure. Property DESCRIPTION is a standard CalDAV field (RFC 5545), so no protocol deviations.

### Principle IV: Performance & Resource Efficiency
✅ **PASS**: URI generation is lightweight (<5ms per task): 1 string concatenation + 2 `encodeURIComponent()` calls. No disk I/O, no heavy computation, no long-running tasks during `onload`. Vault name is fetched once via `this.vault.getName()`. No impact on startup time or mobile performance.

### Principle V: Obsidian Policy Compliance
✅ **PASS**: No deceptive patterns, ads, or spammy notifications. Feature enhances user workflow without policy violations. Proper use of Obsidian API for vault metadata access. No unsafe resource usage. Uses existing TypeScript strict mode and error handling patterns from the codebase.

**Result**: All constitution checks pass. No violations to justify. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── obsidian/              # NEW: Obsidian-specific utilities
│   └── uriBuilder.ts      # NEW: URI generation service (Phase 1 deliverable)
├── sync/
│   └── engine.ts          # MODIFIED: Add URI generation call during task creation
├── caldav/
│   ├── client.ts          # MODIFIED: Accept optional description parameter
│   └── vtodo.ts           # UNCHANGED: Property preservation already handles DESCRIPTION
├── vault/
│   ├── taskParser.ts      # UNCHANGED: Already extracts block IDs
│   └── blockRefManager.ts # UNCHANGED: Already manages block ID lifecycle
└── types.ts               # POTENTIALLY MODIFIED: Add DESCRIPTION to VTODO type if needed

tests/
├── manual/                # EXISTING: Manual testing in dev vault
└── (unit tests TBD)       # FUTURE: Unit tests for URI builder
```

**Structure Decision**: Single Obsidian plugin project following existing modular architecture. New functionality is isolated in `src/obsidian/uriBuilder.ts` with minimal integration points in existing sync and CalDAV modules. No new directories needed beyond the `obsidian/` folder for Obsidian-specific utilities. This structure maintains clear separation between vault operations, sync orchestration, and CalDAV protocol handling.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A - No constitution violations detected.

---

## Phase 0: Research - COMPLETED ✓

**Output**: `research.md`

**Key Findings**:
1. **URI Format**: Standard `obsidian://open?vault=...&file=...&block=...` format
2. **DESCRIPTION Field**: RFC 5545 standard field, universally supported by CalDAV servers
3. **URL Encoding**: `encodeURIComponent()` for vault name and file paths
4. **Integration Point**: `createTaskOnCalDAV()` in `sync/engine.ts`
5. **Property Preservation**: Existing pattern in `updateVTODOProperties()` automatically handles DESCRIPTION
6. **Error Handling**: Graceful degradation - skip URI generation on errors, log warnings
7. **RFC 5545 Compliance**: Reuse existing `escapeText()` function for DESCRIPTION content
8. **No Dependencies**: All required APIs and utilities already present in codebase

**Unknowns Resolved**: All NEEDS CLARIFICATION items from Technical Context resolved through codebase exploration.

---

## Phase 1: Design & Contracts - COMPLETED ✓

**Outputs**:
- `data-model.md`: Entity definitions, data transformations, state models
- `contracts/uriBuilder.ts`: URI builder function signatures and contracts
- `contracts/syncEngine.ts`: Sync engine integration specifications
- `contracts/caldavClient.ts`: CalDAV client modifications
- `quickstart.md`: Developer implementation guide (3-4 hours estimated)

**Design Decisions**:
1. **New Module**: `src/obsidian/uriBuilder.ts` (~50 lines)
   - Pure functions: `buildObsidianURI()`, `buildDescriptionWithURI()`, `isValidBlockId()`
   - No state, no side effects, no external dependencies
   - Unit testable (though manual testing preferred for v1)

2. **Minimal Modifications**:
   - `src/sync/engine.ts`: Add ~10 lines in `createTaskOnCalDAV()` for URI generation
   - `src/caldav/client.ts`: Add optional `description` parameter to `createTask()` (~5 lines)
   - `src/caldav/vtodo.ts`: NO CHANGES (property preservation already works)

3. **Data Flow**:
   ```
   Task Object → URI Builder → Sync Engine → CalDAV Client → VTODO → CalDAV Server
   (blockId)     (generate URI)  (try-catch)    (add DESCRIPTION)  (store)
   ```

4. **Error Handling**: Try-catch wrapper in sync engine, log warnings, continue without URI

5. **Performance**: <5ms per task for URI generation, no network/disk I/O overhead

**Architecture Validation**:
- ✅ Modular design with clear separation of concerns
- ✅ Backward compatible (optional parameter, graceful degradation)
- ✅ Leverages existing patterns (property preservation, RFC 5545 escaping)
- ✅ No breaking changes to public APIs or plugin behavior
- ✅ Minimal code changes (~65 lines total across 3 files)

---

## Constitution Re-Check (Post-Design)

*Re-evaluating constitution compliance after Phase 1 design.*

### Principle I: Modularity & Code Organization
✅ **PASS**: Design confirms modularity:
- New module `uriBuilder.ts` has single responsibility (URI generation)
- Module is <100 lines (well under 200-300 line limit)
- Integration points are minimal and focused (~10 lines in engine, ~5 in client)
- No changes to main.ts or plugin lifecycle
- Clear module boundaries maintained

### Principle II: Security & Privacy First
✅ **PASS**: Design confirms security compliance:
- All operations are local (no network calls beyond existing CalDAV sync)
- Vault metadata (name, file paths) used only for URI generation
- No data leakage or external transmission
- No telemetry or tracking
- URIs point to local vault content only (no external resources)

### Principle III: Versioning & API Stability
✅ **PASS**: Design confirms API stability:
- No changes to plugin ID or command IDs
- CalDAV client signature extension is backward compatible (optional parameter)
- No breaking changes to existing sync behavior
- DESCRIPTION field is RFC 5545 standard (no protocol deviations)
- Property preservation ensures existing tasks continue syncing correctly

### Principle IV: Performance & Resource Efficiency
✅ **PASS**: Design confirms performance compliance:
- URI generation: <5ms per task (2 `encodeURIComponent()` calls + string concatenation)
- No additional disk I/O (vault name is in-memory API call)
- No additional network requests
- No heavy initialization during `onload`
- No impact on mobile performance (lightweight string operations)
- Memory overhead: ~1KB per task (string allocation only)

### Principle V: Obsidian Policy Compliance
✅ **PASS**: Design confirms policy compliance:
- No deceptive patterns or ads
- Proper use of Obsidian API (`vault.getName()`)
- Error handling follows existing patterns (console warnings, no crashes)
- TypeScript strict mode maintained
- No unsafe resource usage

**Final Result**: All constitution checks pass after Phase 1 design. No violations. Proceed to implementation (Phase 2 via `/speckit.tasks` command).

---

## Implementation Readiness

**Status**: Ready for implementation ✓

**Next Command**: `/speckit.tasks` - Generate actionable tasks.md with dependency-ordered implementation steps.

**Estimated Implementation Time**: 3-4 hours (per quickstart.md)

**Required Resources**:
- CalDAV test server (Nextcloud, Radicale, or iCloud)
- Dev vault with test tasks
- Hot-reload setup (`npm run dev`)

**Success Criteria** (from spec.md):
- Users can navigate from CalDAV clients to Obsidian notes in under 2 clicks
- Obsidian URIs successfully launch Obsidian and navigate to correct note 100% of the time
- Feature works across major CalDAV clients (Apple Calendar, Google Calendar, Thunderbird)
- DESCRIPTION field remains stable after initial sync

---

## Artifacts Generated

```text
specs/003-obsidian-link-sync/
├── plan.md              ✓ This file (complete)
├── research.md          ✓ Phase 0 output (technical decisions)
├── data-model.md        ✓ Phase 1 output (entities and transformations)
├── quickstart.md        ✓ Phase 1 output (implementation guide)
└── contracts/           ✓ Phase 1 output (API contracts)
    ├── uriBuilder.ts
    ├── syncEngine.ts
    └── caldavClient.ts
```

**Agent Context Updated**: ✓ CLAUDE.md updated with technologies from this plan

**Phase 2**: Ready for `/speckit.tasks` command to generate implementation tasks.

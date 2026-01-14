# Implementation Plan: Sync Polish - Notifications, Logging & Data Preservation

**Branch**: `002-sync-polish` | **Date**: 2026-01-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-sync-polish/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Polish the CalDAV task synchronization plugin to improve user experience and data integrity. Three main improvements: (1) Show modal notifications only for errors during automatic sync (eliminate success modals), (2) Add debug logging toggle with minimal default output (only sync start/finish), (3) Preserve CalDAV extended properties (CATEGORIES, PRIORITY, custom properties) when updating tasks from Obsidian. These changes ensure non-intrusive operation, better troubleshooting, and cooperative coexistence with other CalDAV tools.

## Technical Context

**Language/Version**: TypeScript 5.8.3 with strict mode, targeting Obsidian API (latest)
**Primary Dependencies**:
- Obsidian API (latest) - Plugin framework (Notice, Modal, App)
- tsdav ^2.0.6 - CalDAV client library (already installed)

**Storage**:
- Plugin data.json for settings (via Obsidian's Plugin.saveData/loadData API)
- CalDAV server VTODO data (extended properties stored server-side)

**Testing**:
- Vitest for unit tests
- Manual testing in Obsidian vault

**Target Platform**:
- Desktop (Windows, macOS, Linux) and Mobile (iOS, Android)
- `isDesktopOnly: false` in manifest

**Project Type**: Single Obsidian plugin project (extends existing codebase)

**Performance Goals**:
- Debug logging toggle takes effect immediately (< 100ms)
- VTODO property preservation adds minimal overhead (< 50ms per task update)
- No performance regression in sync operations

**Constraints**:
- Must maintain backward compatibility with existing settings
- Must not break existing sync functionality
- VTODO parsing must handle arbitrary properties without validation

**Scale/Scope**:
- Existing codebase with established patterns
- ~5-8 files affected
- No new major dependencies required

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Core Principles Compliance

#### I. Modularity & Code Organization ✅
- **Status**: PASS
- **Verification**:
  - Changes affect existing modules: `notifications.ts`, `logger.ts`, `vtodo.ts`, `client.ts`, `settingsTab.ts`, `settings.ts`
  - No new modules required exceeding 300 lines
  - Follows established module structure from 001-caldav-task-sync

#### II. Security & Privacy First ✅
- **Status**: PASS
- **Verification**:
  - No new network operations (uses existing CalDAV connection)
  - Debug logging only outputs to browser console (no external transmission)
  - Extended property preservation is local data handling
  - No new data collection or telemetry

#### III. Versioning & API Stability ✅
- **Status**: PASS
- **Verification**:
  - Backward-compatible settings change (new `enableDebugLogging` field with default `false`)
  - No changes to command IDs
  - No breaking changes to existing APIs

#### IV. Performance & Resource Efficiency ✅
- **Status**: PASS
- **Verification**:
  - Reduced console output in default mode improves perceived performance
  - Read-before-update adds one additional CalDAV request per update (acceptable)
  - No file watchers or background processes added

#### V. Obsidian Policy Compliance ✅
- **Status**: PASS
- **Verification**:
  - Less intrusive notifications align with guidelines
  - Debug toggle is standard plugin pattern
  - No ads, spammy notifications, or deceptive patterns

### Gate Decision: ✅ PASS

All constitution principles satisfied. No conditions or violations requiring justification. Proceed to Phase 0 research.

## Project Structure

### Documentation (this feature)

```text
specs/002-sync-polish/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── vtodo-extended.md # Extended VTODO property handling
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── main.ts                    # No changes expected
├── settings.ts                # Add enableDebugLogging field
├── types.ts                   # Add CalDAVConfiguration.enableDebugLogging
├── caldav/
│   ├── client.ts              # Add fetchTask() for read-before-update
│   ├── vtodo.ts               # Extend to preserve unknown properties
│   └── errors.ts              # No changes expected
├── sync/
│   ├── engine.ts              # Update to read-before-update pattern
│   ├── filters.ts             # No changes expected
│   ├── mapping.ts             # No changes expected
│   ├── conflictResolver.ts    # No changes expected
│   ├── scheduler.ts           # No changes expected
│   └── logger.ts              # Update with sync start/finish, gated debug
└── ui/
    ├── settingsTab.ts         # Add debug toggle control
    └── notifications.ts       # Update to error-only modal for auto-sync

tests/
├── unit/
│   ├── vtodo.test.ts          # Add property preservation tests
│   ├── logger.test.ts         # Add debug toggle tests
│   └── notifications.test.ts  # Add modal behavior tests
```

**Structure Decision**: Extends existing single project structure. Changes primarily affect existing modules with minimal additions. No new directories or major restructuring needed.

## Complexity Tracking

> **No violations requiring justification**

All changes fit within existing architecture. No new abstraction layers or patterns introduced. Implementation follows established codebase conventions.

## Phase 0: Research & Technical Decisions

### Research Tasks

The following items require investigation:

1. **VTODO Property Preservation Strategy**
   - **Question**: How to parse and preserve arbitrary iCalendar properties?
   - **Research**: iCalendar RFC 5545 property format, tsdav raw data access
   - **Criteria**: Must preserve unknown properties verbatim

2. **Logger Implementation Pattern**
   - **Question**: Best practice for runtime-configurable logging?
   - **Research**: Common patterns for debug toggles in Obsidian plugins
   - **Criteria**: Immediate effect, no restart required

3. **tsdav VTODO Retrieval**
   - **Question**: Does tsdav support fetching raw VTODO data vs parsed objects?
   - **Research**: tsdav API documentation, raw response access
   - **Criteria**: Must access original VTODO string for property preservation

### Research Output

All research findings will be documented in `research.md` with:
- Decision made
- Rationale (why chosen over alternatives)
- Alternatives considered
- Impact on implementation

## Phase 1: Design & Contracts

### Data Model (data-model.md)

Key entities to be detailed/extended:
1. **CalDAVConfiguration** - Add `enableDebugLogging: boolean`
2. **ExtendedVTODO** - Representation of VTODO with preserved properties

### API Contracts (contracts/)

1. **Extended VTODO Contract** (`contracts/vtodo-extended.md`):
   - VTODO raw string format
   - Property parsing/reconstruction
   - Managed vs preserved properties

### Quickstart Guide (quickstart.md)

Developer setup for this feature:
- Understanding existing notification system
- Understanding existing logger
- Testing debug logging toggle
- Testing property preservation

### Agent Context Update

After Phase 1 design, run:
```bash
.specify/scripts/bash/update-agent-context.sh claude
```

This will update CLAUDE.md with any new patterns established.

## Phase 2: Task Breakdown

**Note**: Phase 2 (task generation) is executed by running `/speckit.tasks` AFTER completing this plan. Tasks are not generated during the `/speckit.plan` command.

The task breakdown will cover:
- Update notification system for error-only modals
- Implement debug logging toggle in settings
- Update logger with gated debug output
- Implement VTODO property preservation in vtodo.ts
- Update CalDAV client with read-before-update
- Update sync engine to use new patterns
- Add tests for all changes

## Implementation Notes

### Critical Path

1. ✅ Phase 0: Research VTODO property preservation
2. ✅ Phase 1: Design extended VTODO handling
3. Phase 2: Generate tasks (via `/speckit.tasks`)
4. Implementation follows task order in tasks.md

### Risk Mitigation

**Risk**: VTODO property preservation may not work with all CalDAV servers
- **Mitigation**: Parse conservatively, preserve unknown properties as raw strings

**Risk**: Debug logging may expose sensitive data
- **Mitigation**: Never log credentials, sanitize user data in debug output

**Risk**: Read-before-update adds latency
- **Mitigation**: Only fetch full VTODO when updating, not during read operations

### Testing Strategy

1. **Unit Tests**: Logger toggle, VTODO parsing/reconstruction, notification routing
2. **Integration Tests**: Full sync cycle with property preservation
3. **Manual Testing**: Real CalDAV server with categories/priorities set

### Backward Compatibility

- New `enableDebugLogging` setting defaults to `false` (existing behavior preserved)
- No changes to existing settings schema structure
- Existing VTODO handling remains functional for sync

---

**Plan Status**: ✅ Complete - Ready for Phase 0 Research

**Generated by**: `/speckit.plan` command
**Spec Version**: [spec.md](./spec.md) (2026-01-14)
**Constitution Version**: 1.0.0

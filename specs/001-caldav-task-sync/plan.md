# Implementation Plan: CalDAV Task Synchronization

**Branch**: `001-caldav-task-sync` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-caldav-task-sync/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build an Obsidian plugin that bidirectionally synchronizes tasks from an Obsidian vault to a CalDAV server. Tasks are identified using Obsidian's block reference syntax (`^task-id`), synced automatically at configurable intervals (default 60 seconds), and filtered based on folder paths, tags, and completed task age. The plugin supports the Tasks plugin date format (`📅 YYYY-MM-DD`) and syncs three properties: description, due date, and completion status. Conflicts are resolved using last-write-wins based on modification timestamps.

## Technical Context

**Language/Version**: TypeScript 5.8.3 with strict mode, targeting Obsidian API (latest)
**Primary Dependencies**:
- Obsidian API (latest) - Plugin framework
- tsdav or dav - CalDAV client library (NEEDS CLARIFICATION: which library)
- uuid - Generate stable block reference IDs
- date-fns or dayjs - Date parsing and manipulation (NEEDS CLARIFICATION: which library)

**Storage**:
- Plugin data.json for sync mappings and configuration (via Obsidian's Plugin.saveData/loadData API)
- Vault files (markdown) for task storage
- CalDAV server (remote) for synced tasks

**Testing**:
- Manual testing in Obsidian vault (copy to .obsidian/plugins/)
- Unit tests with Jest or Vitest (NEEDS CLARIFICATION: testing framework)
- Integration tests with mock CalDAV server (NEEDS CLARIFICATION: approach)

**Target Platform**:
- Desktop (Windows, macOS, Linux) and Mobile (iOS, Android)
- Requires network connectivity for CalDAV sync
- `isDesktopOnly: false` in manifest

**Project Type**: Single Obsidian plugin project

**Performance Goals**:
- Automatic sync operations complete within 5 seconds for 100 tasks
- UI remains responsive during sync (no blocking operations)
- Plugin startup overhead < 500ms
- Minimal memory footprint (< 50MB on mobile)

**Constraints**:
- Network requests may fail - must handle gracefully with retry
- Block reference IDs must persist through file modifications
- Filter evaluation must be 100% accurate
- No data loss during sync failures (atomic operations)
- Sync timer precision ±5 seconds tolerance
- Must comply with Obsidian's resource cleanup requirements

**Scale/Scope**:
- Support vaults with 1000+ tasks
- Handle 100 tasks per sync cycle efficiently
- Up to 50 excluded folders, 20 excluded tags configurable
- Support vault file structure changes without breaking sync

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Core Principles Compliance

#### I. Modularity & Code Organization ✅
- **Status**: PASS (with implementation requirements)
- **Verification**:
  - `main.ts` will only handle plugin lifecycle and command registration
  - Feature modules required:
    - `src/caldav/client.ts` - CalDAV API communication
    - `src/sync/engine.ts` - Bidirectional sync logic
    - `src/sync/filters.ts` - Filter evaluation (paths, tags, age)
    - `src/sync/mapping.ts` - Task-to-CalDAV mapping persistence
    - `src/vault/scanner.ts` - Vault task discovery
    - `src/vault/taskParser.ts` - Parse task markdown syntax
    - `src/ui/settingsTab.ts` - Settings UI
    - `src/types.ts` - TypeScript interfaces
  - Each module < 300 lines
  - Build artifacts in .gitignore

#### II. Security & Privacy First ⚠️
- **Status**: REQUIRES ATTENTION
- **Network Operations**: CalDAV sync requires network requests to user-configured server
- **Compliance Actions Required**:
  - ✅ Network requests only to user-specified CalDAV server URL
  - ✅ Explicit user opt-in via settings configuration
  - ✅ NO telemetry or analytics
  - ✅ NO remote code execution
  - ⚠️ MUST document in README.md:
    - CalDAV server receives task data (description, due date, status)
    - Network requirements and data transmission
    - User credentials stored locally in plugin data.json
  - ⚠️ MUST document in settings UI:
    - Warning about network data transmission
    - Explanation of what data is sent to CalDAV server
  - ✅ Use `this.register*` helpers for all timers and event handlers
  - ✅ Clean up automatic sync interval on plugin unload

#### III. Versioning & API Stability ✅
- **Status**: PASS
- **Verification**:
  - Plugin ID: `obsidian-tasks-caldev` (IMMUTABLE after first release)
  - Command IDs must remain stable (define in Phase 1)
  - Use SemVer for version bumps
  - Maintain `versions.json` for minAppVersion compatibility
  - GitHub release tags match manifest.json version exactly (no "v" prefix)

#### IV. Performance & Resource Efficiency ⚠️
- **Status**: REQUIRES ATTENTION
- **Compliance Actions Required**:
  - ✅ Lazy initialization: Defer CalDAV connection until first sync
  - ✅ Debounce file system watchers (if implemented for change detection)
  - ✅ Batch vault scans - scan all tasks once per sync cycle
  - ⚠️ Background sync must not block UI - use async operations
  - ⚠️ Test on mobile - automatic sync may drain battery
  - ⚠️ Consider making automatic sync configurable on/off for mobile
  - ✅ Bundle size: Use lightweight CalDAV client library

#### V. Obsidian Policy Compliance ✅
- **Status**: PASS (with implementation requirements)
- **Verification**:
  - Review https://docs.obsidian.md/Developer+policies
  - Review https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
  - Manifest fields complete: id, name, version, minAppVersion, description
  - Update manifest description to reflect actual functionality
  - Use sentence case in UI copy
  - TypeScript strict mode enabled (verified in tsconfig.json)
  - Use async/await pattern throughout
  - Error handling with user-friendly notifications

### Gate Decision: ✅ PASS WITH CONDITIONS

Proceed to Phase 0 research with the following requirements:
1. Document network data transmission in README.md before implementation
2. Add clear warnings in settings UI about data sent to CalDAV
3. Research lightweight CalDAV client library
4. Research testing strategy for network-dependent plugin
5. Design automatic sync to be non-blocking and mobile-friendly

## Project Structure

### Documentation (this feature)

```text
specs/001-caldav-task-sync/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── caldav-api.md    # CalDAV VTODO format and operations
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── main.ts                    # Plugin lifecycle (onload, onunload, commands)
├── settings.ts                # Existing settings interface
├── types.ts                   # TypeScript interfaces for all entities
├── caldav/
│   ├── client.ts              # CalDAV server communication
│   ├── vtodo.ts               # VTODO format conversion (task <-> CalDAV)
│   └── errors.ts              # CalDAV-specific error types
├── sync/
│   ├── engine.ts              # Bidirectional sync orchestration
│   ├── filters.ts             # Filter evaluation (paths, tags, age)
│   ├── mapping.ts             # Sync mapping persistence and lookup
│   ├── conflictResolver.ts    # Last-write-wins implementation
│   └── scheduler.ts           # Automatic sync interval management
├── vault/
│   ├── scanner.ts             # Scan vault for tasks
│   ├── taskParser.ts          # Parse task markdown (description, date, status)
│   ├── blockRefManager.ts     # Generate and embed block reference IDs
│   └── taskWriter.ts          # Update task lines in vault files
└── ui/
    ├── settingsTab.ts         # Settings UI tab
    ├── notifications.ts       # Modal notifications for errors
    └── syncStatusBar.ts       # Optional: sync status in status bar

tests/                         # (To be created)
├── unit/
│   ├── taskParser.test.ts
│   ├── filters.test.ts
│   ├── vtodo.test.ts
│   └── conflictResolver.test.ts
├── integration/
│   ├── syncEngine.test.ts
│   └── caldavClient.test.ts
└── __mocks__/
    ├── obsidian.ts
    └── caldavServer.ts
```

**Structure Decision**: Single project structure (Option 1) is appropriate. This is a self-contained Obsidian plugin with no separate frontend/backend or mobile app. All code lives in `src/` with clear module boundaries following the constitution's modularity principle. Tests will be added to a `tests/` directory following standard Obsidian plugin patterns.

## Complexity Tracking

> **No violations requiring justification**

All constitution principles can be satisfied with the proposed architecture. The plugin maintains:
- Small, focused modules (each < 300 lines)
- Clear separation of concerns (CalDAV, Sync, Vault, UI)
- No unnecessary abstraction layers
- Direct use of Obsidian API patterns

## Phase 0: Research & Technical Decisions

### Research Tasks

The following unknowns from Technical Context require research:

1. **CalDAV Client Library Selection**
   - **Question**: Which TypeScript CalDAV library should we use?
   - **Options**: tsdav, dav, simple-caldav, custom implementation
   - **Criteria**: Bundle size, TypeScript support, VTODO support, maintenance status, browser compatibility

2. **Date Parsing Library**
   - **Question**: Which date library for parsing Tasks plugin format and CalDAV dates?
   - **Options**: date-fns, dayjs, Temporal API, native Date
   - **Criteria**: Bundle size, timezone handling, parsing flexibility, CalDAV date format support

3. **Testing Framework and Strategy**
   - **Question**: How to test a network-dependent Obsidian plugin?
   - **Research**: Jest vs Vitest, mocking Obsidian API, mocking CalDAV server, testing strategy
   - **Criteria**: TypeScript support, async/await support, mocking capabilities

4. **Sync State Persistence Format**
   - **Question**: How to structure sync mappings in plugin data.json?
   - **Research**: Optimal data structure for lookup by block ID and CalDAV UID
   - **Considerations**: Performance with 1000+ tasks, data integrity

5. **Block Reference ID Generation**
   - **Question**: What format for stable task IDs?
   - **Options**: UUID v4, short hash, sequential, timestamp-based
   - **Criteria**: Collision resistance, readability, URL-safe

6. **Vault File Watching Strategy**
   - **Question**: How to detect task changes between syncs?
   - **Options**: Obsidian's Vault.on('modify'), content hashing, timestamp comparison
   - **Considerations**: Performance, reliability, mobile compatibility

7. **CalDAV Authentication Best Practices**
   - **Question**: How to securely store CalDAV credentials?
   - **Research**: Obsidian's data.json security, credential storage patterns
   - **Considerations**: User password security, token-based auth support

### Research Output

All research findings will be documented in `research.md` with:
- Decision made
- Rationale (why chosen over alternatives)
- Alternatives considered
- Impact on implementation

## Phase 1: Design & Contracts

### Data Model (data-model.md)

Key entities to be detailed:
1. **Task** - Obsidian task representation
2. **SyncMapping** - Link between Obsidian task and CalDAV VTODO
3. **CalDAVConfiguration** - User settings
4. **SyncFilter** - Filter rules
5. **CalDAVTask** - CalDAV VTODO representation

### API Contracts (contracts/)

1. **CalDAV API Contract** (`contracts/caldav-api.md`):
   - CalDAV server endpoints (PROPFIND, REPORT, PUT, DELETE)
   - VTODO format specification
   - Authentication headers
   - Error response formats

2. **Internal Module Contracts**:
   - SyncEngine interface
   - CalDAVClient interface
   - TaskParser interface
   - FilterEngine interface

### Quickstart Guide (quickstart.md)

Developer setup instructions:
- Clone repository
- Install dependencies
- Configure test CalDAV server
- Run development build
- Test in local vault
- Run tests

### Agent Context Update

After Phase 1 design, run:
```bash
.specify/scripts/bash/update-agent-context.sh claude
```

This will update `.claude/agent-context.md` with:
- tsdav (or selected CalDAV library)
- date-fns (or selected date library)
- Selected testing framework
- Obsidian API patterns

## Phase 2: Task Breakdown

**Note**: Phase 2 (task generation) is executed by running `/speckit.tasks` AFTER completing this plan. Tasks are not generated during the `/speckit.plan` command.

The task breakdown will be generated from this plan and will cover:
- Initial project setup and configuration
- CalDAV client implementation
- Vault scanning and task parsing
- Sync engine with bidirectional logic
- Filter implementation
- UI/settings tab
- Testing and documentation

## Implementation Notes

### Critical Path

1. ✅ Phase 0: Research and select libraries
2. ✅ Phase 1: Design data models and contracts
3. Phase 2: Generate tasks (via `/speckit.tasks`)
4. Implementation follows task order in tasks.md

### Risk Mitigation

**Risk**: CalDAV servers may have rate limits or connection issues
- **Mitigation**: Implement exponential backoff, respect rate limits, graceful degradation

**Risk**: Task modifications during sync may cause conflicts
- **Mitigation**: Last-write-wins with timestamps, atomic file operations

**Risk**: Block reference IDs may collide
- **Mitigation**: Use UUID v4 or equivalent with sufficient entropy

**Risk**: Mobile battery drain from automatic sync
- **Mitigation**: Make sync interval configurable, consider mobile-specific defaults

**Risk**: Large vaults (1000+ tasks) may have slow sync
- **Mitigation**: Batch operations, incremental sync, performance testing

### Testing Strategy

1. **Unit Tests**: Individual module logic (filters, parsers, conflict resolution)
2. **Integration Tests**: Sync engine with mock CalDAV server
3. **Manual Testing**: Real Obsidian vault with real CalDAV server (e.g., Nextcloud, Radicale)
4. **Mobile Testing**: Test on iOS and Android devices for performance and battery impact

### Documentation Requirements

Before implementation:
- [ ] Update README.md with network data transmission disclosure
- [ ] Add CalDAV setup instructions
- [ ] Document supported CalDAV servers
- [ ] Add privacy policy section

During implementation:
- [ ] Add JSDoc comments to all public interfaces
- [ ] Document configuration options in settings UI
- [ ] Add troubleshooting guide

## Next Steps

1. **Run Phase 0 Research**: Execute research tasks and populate `research.md`
2. **Run Phase 1 Design**: Generate `data-model.md`, `contracts/`, and `quickstart.md`
3. **Update Agent Context**: Run `update-agent-context.sh claude`
4. **Generate Tasks**: Run `/speckit.tasks` to create implementation task breakdown
5. **Begin Implementation**: Follow tasks in `tasks.md` in order

---

**Plan Status**: ✅ Complete - Ready for Phase 0 Research

**Generated by**: `/speckit.plan` command
**Spec Version**: [spec.md](./spec.md) (2026-01-08)
**Constitution Version**: 1.0.0

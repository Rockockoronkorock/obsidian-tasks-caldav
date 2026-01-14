# Tasks: Sync Polish - Notifications, Logging & Data Preservation

**Input**: Design documents from `/specs/002-sync-polish/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/vtodo-extended.md, quickstart.md

**Tests**: Tests are OPTIONAL for this feature - they are NOT explicitly requested in the specification, so they are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definition updates for debug logging

- [X] T001 Add enableDebugLogging: boolean to CalDAVConfiguration interface in src/types.ts
- [X] T002 Add enableDebugLogging: false to DEFAULT_SETTINGS in src/settings.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Wire setDebugMode(this.settings.enableDebugLogging) in onload() method in src/main.ts
- [X] T004 [P] Add syncStart() INFO-level method to Logger class in src/sync/logger.ts
- [X] T005 [P] Add syncComplete() INFO-level method to Logger class in src/sync/logger.ts
- [X] T006 [P] Add escapeICalText() helper function to src/caldav/vtodo.ts
- [X] T007 [P] Add unescapeICalText() helper function to src/caldav/vtodo.ts
- [X] T008 [P] Add formatDateForCalDAV() helper function to src/caldav/vtodo.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Error-Only Modal Notifications (Priority: P1) 🎯 MVP

**Goal**: Display modal notifications only for errors during automatic sync, avoiding unnecessary interruptions for successful syncs

**Independent Test**: Configure automatic sync, trigger successful syncs (no modal should appear), then trigger error conditions like network disconnect or wrong credentials (modal should appear with error details)

### Implementation for User Story 1

- [X] T009 [US1] Add isAutoSync: boolean parameter to syncObsidianToCalDAV() method signature in src/sync/engine.ts
- [X] T010 [US1] Add isAutoSync: boolean parameter to syncCalDAVToObsidian() method signature in src/sync/engine.ts (N/A - only syncObsidianToCalDAV exists, it does bidirectional)
- [X] T011 [US1] Update syncObsidianToCalDAV() to conditionally call showSyncStart() only when isAutoSync is false in src/sync/engine.ts
- [X] T012 [US1] Update syncObsidianToCalDAV() to conditionally call showSyncSuccess() only when isAutoSync is false in src/sync/engine.ts
- [X] T013 [US1] Update syncCalDAVToObsidian() to conditionally call showSyncStart() only when isAutoSync is false in src/sync/engine.ts (N/A - covered by T011)
- [X] T014 [US1] Update syncCalDAVToObsidian() to conditionally call showSyncSuccess() only when isAutoSync is false in src/sync/engine.ts (N/A - covered by T012)
- [X] T015 [US1] Update automatic sync scheduler to pass isAutoSync: true when calling sync methods in src/sync/scheduler.ts
- [X] T016 [US1] Remove any inline Notice() calls for filter stats during auto-sync in src/sync/engine.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently - automatic syncs should not show modal notifications for success, only for errors

---

## Phase 4: User Story 2 - Configurable Debug Logging (Priority: P1)

**Goal**: Provide a debug logging toggle in settings that shows only essential sync information (sync started/finished) by default, with detailed debug logs available when enabled

**Independent Test**: Open browser console with debug logging disabled (default), trigger sync and verify only "Sync started" and "Sync finished" appear, then enable debug logging in settings and trigger sync to verify detailed logs appear without restart

### Implementation for User Story 2

- [X] T017 [P] [US2] Add debug logging toggle control to settings tab in src/ui/settingsTab.ts
- [X] T018 [US2] Wire debug toggle onChange to call setDebugMode(value) and saveSettings() in src/ui/settingsTab.ts
- [X] T019 [US2] Update syncObsidianToCalDAV() to call Logger.syncStart() at beginning in src/sync/engine.ts
- [X] T020 [US2] Update syncObsidianToCalDAV() to call Logger.syncComplete() at end in src/sync/engine.ts
- [X] T021 [US2] Update syncCalDAVToObsidian() to call Logger.syncStart() at beginning in src/sync/engine.ts (N/A - covered by T019)
- [X] T022 [US2] Update syncCalDAVToObsidian() to call Logger.syncComplete() at end in src/sync/engine.ts (N/A - covered by T020)
- [X] T023 [US2] Audit all Logger.debug() calls in src/sync/engine.ts to ensure they are at DEBUG level not INFO level
- [X] T024 [P] [US2] Audit all Logger.debug() calls in src/caldav/client.ts to ensure they are at DEBUG level not INFO level
- [X] T025 [P] [US2] Audit all Logger.debug() calls in src/caldav/vtodo.ts to ensure they are at DEBUG level not INFO level

**Checkpoint**: At this point, User Story 2 should be fully functional - debug toggle should work immediately without restart, console output should be minimal by default

---

## Phase 5: User Story 3 - Preserve CalDAV Extended Properties (Priority: P2)

**Goal**: Preserve CalDAV extended properties (categories, priority, custom properties) when updating tasks from Obsidian, ensuring non-destructive sync with other CalDAV clients

**Independent Test**: Create task in Obsidian, sync to CalDAV, add category/priority via CalDAV client, modify task description in Obsidian, sync again, verify category/priority preserved on CalDAV

### Implementation for User Story 3

- [X] T026 [P] [US3] Add updateVTODOProperties() function to src/caldav/vtodo.ts following contract specification
- [X] T027 [P] [US3] Add fetchTaskRawData(uid: string) method to CalDAVClient class in src/caldav/client.ts
- [X] T028 [US3] Add updateTaskWithPreservation() method to CalDAVClient class in src/caldav/client.ts
- [X] T029 [US3] Update SyncEngine.pushTaskToCalDAV() to use read-before-update pattern in src/sync/engine.ts
- [X] T030 [US3] Update SyncEngine to call fetchTaskRawData() before updateTaskWithPreservation() in src/sync/engine.ts (integrated in T028)
- [X] T031 [US3] Add validation after property replacement to ensure no property duplication in src/caldav/vtodo.ts
- [X] T032 [US3] Add error handling for malformed VTODO data with fallback to full replacement in src/caldav/vtodo.ts

**Checkpoint**: All user stories should now be independently functional - extended properties should survive round-trip sync

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T033 [P] Update CLAUDE.md with new patterns from this feature via update-agent-context.sh script
- [X] T034 [P] Add debug logging for VTODO property preservation (input/output strings) in src/caldav/vtodo.ts
- [X] T035 [P] Verify all text in SUMMARY fields is properly escaped using escapeICalText() in src/caldav/vtodo.ts
- [X] T036 [P] Verify all timestamp updates use ISO 8601 UTC format in src/caldav/vtodo.ts
- [X] T037 Code cleanup: Remove any unused notification functions in src/ui/notifications.ts (none found, all in use)
- [ ] T038 Run manual testing per quickstart.md validation scenarios (manual testing required by user)
- [X] T039 Verify backward compatibility: missing enableDebugLogging defaults to false

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3, 4, 5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories

### Within Each User Story

- US1: Tasks T009-T016 must execute sequentially (all modify engine.ts sync methods)
- US2: Tasks T017-T018 (settings UI) parallel with T019-T022 (engine updates), then T023-T025 audit in parallel
- US3: Tasks T026-T027 in parallel, then T028, then T029-T030, finally T031-T032 in parallel

### Parallel Opportunities

- Phase 1: Both tasks can run in parallel (different sections of different files)
- Phase 2: T004-T005 (logger methods) parallel with T006-T008 (vtodo helpers)
- Phase 3 (US1): Sequential execution required (same methods in engine.ts)
- Phase 4 (US2): T017-T018 parallel with T019-T022, then T023-T025 in parallel
- Phase 5 (US3): T026-T027 parallel, T031-T032 parallel
- Phase 6: T033-T036 all parallel, then T037-T039 sequential

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch logger method additions in parallel:
Task: "Add syncStart() INFO-level method to Logger class in src/sync/logger.ts"
Task: "Add syncComplete() INFO-level method to Logger class in src/sync/logger.ts"

# Launch vtodo helper functions in parallel:
Task: "Add escapeICalText() helper function to src/caldav/vtodo.ts"
Task: "Add unescapeICalText() helper function to src/caldav/vtodo.ts"
Task: "Add formatDateForCalDAV() helper function to src/caldav/vtodo.ts"
```

## Parallel Example: User Story 2

```bash
# Launch settings UI updates in parallel with engine updates:
Task: "Add debug logging toggle control to settings tab in src/ui/settingsTab.ts"
Task: "Wire debug toggle onChange to call setDebugMode(value) and saveSettings() in src/ui/settingsTab.ts"

# In parallel:
Task: "Update syncObsidianToCalDAV() to call Logger.syncStart() at beginning in src/sync/engine.ts"
Task: "Update syncObsidianToCalDAV() to call Logger.syncComplete() at end in src/sync/engine.ts"

# Launch audit tasks in parallel:
Task: "Audit all Logger.debug() calls in src/sync/engine.ts to ensure they are at DEBUG level not INFO level"
Task: "Audit all Logger.debug() calls in src/caldav/client.ts to ensure they are at DEBUG level not INFO level"
Task: "Audit all Logger.debug() calls in src/caldav/vtodo.ts to ensure they are at DEBUG level not INFO level"
```

## Parallel Example: User Story 3

```bash
# Launch VTODO functions in parallel:
Task: "Add updateVTODOProperties() function to src/caldav/vtodo.ts following contract specification"
Task: "Add fetchTaskRawData(uid: string) method to CalDAVClient class in src/caldav/client.ts"

# Later, launch validation in parallel:
Task: "Add validation after property replacement to ensure no property duplication in src/caldav/vtodo.ts"
Task: "Add error handling for malformed VTODO data with fallback to full replacement in src/caldav/vtodo.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 - Both P1)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T008) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T009-T016) - Error-only modals
4. Complete Phase 4: User Story 2 (T017-T025) - Debug logging
5. **STOP and VALIDATE**: Test both US1 and US2 independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Better UX with error-only modals
3. Add User Story 2 → Test independently → Better debugging experience
4. Add User Story 3 → Test independently → Non-destructive sync with other tools
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T008)
2. Once Foundational is done:
   - Developer A: User Story 1 (T009-T016)
   - Developer B: User Story 2 (T017-T025)
   - Developer C: User Story 3 (T026-T032)
3. Stories complete and integrate independently
4. Team completes Polish together (T033-T039)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests are NOT included in this task breakdown (not explicitly requested)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US1 and US2 are both P1 priority and should be completed for MVP
- US3 is P2 and can be deferred if needed

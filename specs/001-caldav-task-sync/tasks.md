# Tasks: CalDAV Task Synchronization

**Input**: Design documents from `/specs/001-caldav-task-sync/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/caldav-api.md, quickstart.md

**Tests**: Not requested in feature specification - focusing on implementation tasks only

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

-   **[P]**: Can run in parallel (different files, no dependencies)
-   **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5, US6)
-   Include exact file paths in descriptions

## Path Conventions

Single Obsidian plugin project structure at repository root:

-   `src/` - Source code
-   `tests/` - Test files (for future use)
-   `manifest.json`, `package.json` - Configuration files

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

-   [x] T001 Install dependencies from package.json: tsdav, typescript@5.8.3+, esbuild, vitest
-   [x] T002 [P] Configure TypeScript compiler in tsconfig.json with strict mode enabled
-   [x] T003 [P] Create src/ directory structure with subdirectories: caldav/, sync/, vault/, ui/
-   [x] T004 [P] Create base TypeScript interfaces in src/types.ts for Task, SyncMapping, CalDAVConfiguration, CalDAVTask, TaskStatus, VTODOStatus enums
-   [x] T005 [P] Update manifest.json with plugin metadata: id, name, version, minAppVersion, description, isDesktopOnly: false
-   [x] T006 Verify build process works: npm run build produces main.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

-   [x] T007 Create plugin lifecycle skeleton in src/main.ts with onload(), onunload(), loadSettings(), saveSettings() methods
-   [x] T008 [P] Implement settings persistence in src/settings.ts with CalDAVConfiguration interface and default values
-   [x] T009 [P] Create date parsing utilities in src/vault/taskParser.ts: parseTasksPluginDate(), toCalDAVDate(), parseCalDAVDate() functions
-   [x] T010 [P] Create content hash utility in src/sync/mapping.ts: hashTaskContent() function for change detection
-   [x] T011 [P] Create block reference ID generator in src/vault/blockRefManager.ts: generateTaskBlockId() using crypto.randomUUID()
-   [x] T012 Implement error types in src/caldav/errors.ts: CalDAVError, CalDAVAuthError, CalDAVNetworkError, CalDAVConflictError classes
-   [x] T013 Implement SyncMapping storage in src/sync/mapping.ts: loadMappings(), saveMappings(), getMappingByBlockId(), setMapping(), removeMapping() methods

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 4 - Configure CalDAV Connection (Priority: P1) 🎯 MVP-Required

**Goal**: Enable users to configure CalDAV server credentials and establish connection

**Independent Test**: Open plugin settings, enter valid CalDAV credentials (server URL, username, password), save settings, verify connection succeeds and credentials persist across Obsidian restarts

### Implementation for User Story 4

-   [x] T014 [P] [US4] Create settings tab UI in src/ui/settingsTab.ts extending PluginSettingTab with connection section
-   [x] T015 [US4] Add server URL input field in src/ui/settingsTab.ts with HTTPS validation
-   [x] T016 [US4] Add username input field in src/ui/settingsTab.ts
-   [x] T017 [US4] Add password input field in src/ui/settingsTab.ts with password masking
-   [x] T018 [US4] Add calendar path input field in src/ui/settingsTab.ts with default value suggestion
-   [x] T019 [US4] Implement CalDAV client wrapper in src/caldav/client.ts: CalDAVClient class with connect(), disconnect(), testConnection() methods using tsdav
-   [x] T020 [US4] Add "Test Connection" button in src/ui/settingsTab.ts that calls CalDAVClient.testConnection() and displays result
-   [x] T021 [US4] Implement connection validation in src/caldav/client.ts with authentication error handling
-   [x] T022 [US4] Add success/error notifications in src/ui/settingsTab.ts using Obsidian Notice API
-   [x] T023 [US4] Register settings tab in src/main.ts using this.addSettingTab()

**Checkpoint**: At this point, users can configure CalDAV connection and verify it works

---

## Phase 4: User Story 5 - Configure Automatic Sync Interval (Priority: P1) 🎯 MVP-Required

**Goal**: Allow users to control automatic sync frequency with configurable interval

**Independent Test**: Open settings, change sync interval from 60 to 120 seconds, save, verify syncs occur every 120 seconds; trigger manual sync and verify timer resets

### Implementation for User Story 5

-   [x] T024 [P] [US5] Add sync settings section to src/ui/settingsTab.ts
-   [x] T025 [US5] Add sync interval input field in src/ui/settingsTab.ts with default 60 seconds and minimum 10 seconds validation
-   [x] T026 [US5] Add enable/disable auto-sync toggle in src/ui/settingsTab.ts with default enabled
-   [x] T027 [US5] Implement sync scheduler in src/sync/scheduler.ts: SyncScheduler class with start(), stop(), reset() methods
-   [x] T028 [US5] Register sync interval in src/main.ts using this.registerInterval() for automatic cleanup
-   [x] T029 [US5] Add manual sync command in src/main.ts using this.addCommand() with id: 'manual-sync'
-   [x] T030 [US5] Implement timer reset logic in src/sync/scheduler.ts when manual sync is triggered
-   [x] T031 [US5] Add sync status notification in src/ui/notifications.ts: showSyncStart(), showSyncSuccess(), showSyncError() functions
-   [x] T032 [US5] Implement modal error notification in src/ui/notifications.ts using Obsidian Modal API for automatic sync errors

**Checkpoint**: At this point, automatic sync runs at configured intervals with manual trigger capability

---

## Phase 5: User Story 1 - Initial Task Sync from Obsidian to CalDAV (Priority: P1) 🎯 MVP

**Goal**: Enable initial sync of tasks from Obsidian vault to CalDAV server

**Independent Test**: Create tasks in Obsidian vault with various formats (with/without due dates, completed/open), trigger sync, verify all tasks appear on CalDAV server with correct data

### Implementation for User Story 1

-   [x] T033 [P] [US1] Implement vault scanner in src/vault/scanner.ts: scanVaultForTasks() method using Vault.getMarkdownFiles()
-   [x] T034 [P] [US1] Implement task parser in src/vault/taskParser.ts: parseTaskLine() method to extract description, dueDate, status, tags, blockId from markdown
-   [x] T035 [US1] Implement block reference embedder in src/vault/blockRefManager.ts: embedBlockId() method to add ^task-uuid to task lines
-   [x] T036 [US1] Implement task file writer in src/vault/taskWriter.ts: updateTaskLine() method to modify tasks in vault files
-   [x] T037 [P] [US1] Implement VTODO converter in src/caldav/vtodo.ts: taskToVTODO() method to convert Task to iCalendar VTODO format
-   [x] T038 [US1] Implement CalDAV task creation in src/caldav/client.ts: createTask() method using tsdav createCalendarObject()
-   [x] T039 [US1] Implement sync filter in src/sync/filters.ts: SyncFilter class with shouldSync() method (placeholder, returns true for now)
-   [x] T040 [US1] Implement initial sync logic in src/sync/engine.ts: syncObsidianToCalDAV() method
-   [x] T041 [US1] Wire sync engine to manual sync command in src/main.ts
-   [x] T042 [US1] Add block ID generation for untracked tasks in src/sync/engine.ts during initial sync
-   [x] T043 [US1] Store sync mappings after successful task creation in src/sync/engine.ts
-   [x] T044 [US1] Add error handling for failed task uploads with skip and continue logic in src/sync/engine.ts
-   [x] T045 [US1] Add sync progress feedback using Notice API in src/sync/engine.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - tasks sync from Obsidian to CalDAV

---

## Phase 6: User Story 2 - Update Synced Tasks from Obsidian to CalDAV (Priority: P2)

**Goal**: Propagate task modifications made in Obsidian to CalDAV server

**Independent Test**: Sync a task, modify its description/due date/status in Obsidian, wait for next automatic sync, verify changes appear on CalDAV server

### Implementation for User Story 2

-   [x] T046 [P] [US2] Implement change detection in src/sync/engine.ts: detectObsidianChanges() method comparing current hash with lastKnownContentHash
-   [x] T047 [US2] Implement CalDAV task update in src/caldav/client.ts: updateTask() method using tsdav updateCalendarObject() with ETag handling
-   [x] T048 [US2] Implement update sync logic in src/sync/engine.ts: updateCalDAVTask() method
-   [x] T049 [US2] Add ETag conflict handling in src/caldav/client.ts with retry on 412 Precondition Failed
-   [x] T050 [US2] Update sync mapping timestamps and hashes in src/sync/engine.ts after successful update
-   [x] T051 [US2] Integrate update detection into main sync cycle in src/sync/engine.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - initial sync and updates from Obsidian to CalDAV

---

## Phase 7: User Story 3 - Update Synced Tasks from CalDAV to Obsidian (Priority: P3)

**Goal**: Pull task modifications from CalDAV server back into Obsidian vault

**Independent Test**: Sync a task, modify it on CalDAV server (using any CalDAV client), wait for next automatic sync in Obsidian, verify changes appear in vault

### Implementation for User Story 3

-   [x] T052 [P] [US3] Implement CalDAV task fetching in src/caldav/client.ts: fetchAllTasks() method using tsdav fetchCalendarObjects()
-   [x] T053 [P] [US3] Implement VTODO parser in src/caldav/vtodo.ts: vtodoToTask() method to convert iCalendar VTODO to Task
-   [x] T054 [US3] Implement change detection for CalDAV in src/sync/engine.ts: detectCalDAVChanges() method comparing lastModified timestamps
-   [x] T055 [US3] Implement Obsidian task update in src/vault/taskWriter.ts: updateTaskInVault() method to modify task lines
-   [x] T056 [US3] Implement CalDAV-to-Obsidian sync logic in src/sync/engine.ts: updateObsidianTask() method
-   [x] T057 [US3] Implement conflict resolution in src/sync/conflictResolver.ts: resolveConflict() using last-write-wins strategy
-   [x] T058 [US3] Integrate bidirectional sync into main sync cycle in src/sync/engine.ts
-   [x] T059 [US3] Update sync mapping timestamps after CalDAV-to-Obsidian sync in src/sync/engine.ts
-   [x] T060 [US3] Add conflict resolution logging in src/sync/conflictResolver.ts

**Checkpoint**: All sync directions now work - bidirectional sync is complete

---

## Phase 8: User Story 6 - Configure Sync Filters (Priority: P2)

**Goal**: Allow users to control which tasks sync based on folder paths, tags, and completed task age

**Independent Test**: Configure filters (exclude "Archive/" folder, exclude "#private" tag, set 30-day threshold), create matching and non-matching tasks, verify only appropriate tasks sync

### Implementation for User Story 6

-   [X] T061 [P] [US6] Add filter settings section to src/ui/settingsTab.ts
-   [X] T062 [US6] Add excluded folders list input in src/ui/settingsTab.ts with add/remove buttons
-   [X] T063 [US6] Add excluded tags list input in src/ui/settingsTab.ts with add/remove buttons
-   [X] T064 [US6] Add completed task age threshold input in src/ui/settingsTab.ts with default 30 days
-   [X] T065 [P] [US6] Implement folder exclusion check in src/sync/filters.ts: matchesFolderExclusion() method with recursive subfolder logic
-   [X] T066 [P] [US6] Implement tag exclusion check in src/sync/filters.ts: hasExcludedTag() method
-   [X] T067 [P] [US6] Implement age threshold check in src/sync/filters.ts: isCompletedTooOld() method
-   [X] T068 [US6] Update shouldSync() method in src/sync/filters.ts to apply all filters with AND logic
-   [X] T069 [US6] Integrate SyncFilter into sync engine in src/sync/engine.ts before task upload
-   [X] T070 [US6] Add filter validation in src/ui/settingsTab.ts: folder paths end with "/", tags start with "#"
-   [X] T071 [US6] Add warning notification for filtered tasks in src/sync/engine.ts with count of excluded tasks

**Checkpoint**: Filter configuration is complete - users have full control over what syncs

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

-   [ ] Refactor code especially `engine.ts` for better readability.
-   [ ] T072 [P] Add comprehensive error handling for network failures across all sync operations in src/sync/engine.ts
-   [ ] T073 [P] Implement retry logic with exponential backoff in src/caldav/client.ts using withRetry() wrapper
-   [ ] T074 [P] Add sync state preservation on errors in src/sync/engine.ts (atomic operations, rollback on failure)
-   [ ] T075 [P] Implement automatic retry on next interval after sync failure in src/sync/scheduler.ts
-   [ ] T076 [P] Add detailed logging throughout sync process in src/sync/engine.ts for debugging
-   [ ] T077 [P] Optimize vault scanning for large vaults in src/vault/scanner.ts (batch processing, skip binary files)
-   [ ] T078 [P] Add input validation for all settings fields in src/ui/settingsTab.ts
-   [ ] T079 [P] Update README.md with setup instructions, CalDAV server compatibility, privacy policy, and usage guide
-   [ ] T080 [P] Add JSDoc comments to all public interfaces and methods in src/types.ts, src/caldav/client.ts, src/sync/engine.ts
-   [ ] T081 [P] Create troubleshooting guide in docs/troubleshooting.md
-   [ ] T082 [P] Verify mobile compatibility (iOS/Android) per quickstart.md testing instructions
-   [ ] T083 Validate all constitution compliance requirements from plan.md
-   [ ] T084 Final build and bundle size check (ensure < 200KB per constitution guidelines)
-   [ ] T085 Run through quickstart.md validation with local Radicale server

---

## Dependencies & Execution Order

### Phase Dependencies

-   **Setup (Phase 1)**: No dependencies - can start immediately
-   **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
-   **User Stories (Phase 3-8)**: All depend on Foundational phase completion
    -   US4 (Configure CalDAV) - Can start after Foundational (required for all sync operations)
    -   US5 (Configure Auto-Sync) - Can start after Foundational (required for automatic sync)
    -   US1 (Initial Sync) - Depends on US4, US5 (needs connection and scheduler)
    -   US2 (Update Obsidian→CalDAV) - Depends on US1 (extends initial sync)
    -   US3 (Update CalDAV→Obsidian) - Depends on US1 (extends initial sync, can be parallel with US2)
    -   US6 (Filters) - Can integrate into US1/US2 once basic sync works
-   **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Phase 2 (Foundational)
    ↓
    ├─→ US4 (Configure CalDAV Connection) ─┐
    └─→ US5 (Configure Auto-Sync Interval) ─┤
                                             ↓
                                    US1 (Initial Sync) ─┬─→ US2 (Update Obsidian→CalDAV)
                                             ↓          │
                                    US6 (Filters) ◀────┴─→ US3 (Update CalDAV→Obsidian)
```

**Critical Path for MVP**: Phase 1 → Phase 2 → US4 → US5 → US1 (T001-T045)

### Within Each User Story

-   Settings UI before sync logic (US4, US5, US6)
-   Scanner/Parser before sync engine (US1)
-   Basic CRUD before change detection (US1 before US2/US3)
-   CalDAV client methods before sync engine usage
-   Error handling integrated throughout

### Parallel Opportunities

-   **Setup (Phase 1)**: T002, T003, T004, T005 can run in parallel (different files)
-   **Foundational (Phase 2)**: T008, T009, T010, T011 can run in parallel (different modules)
-   **US4 (Configure CalDAV)**: T014 (UI) can run parallel with T019 (client), then integrate at T020-T023
-   **US5 (Auto-Sync)**: T024-T026 (UI) can run parallel with T027 (scheduler)
-   **US1 (Initial Sync)**: T033, T034 (vault) can run parallel with T037 (VTODO conversion)
-   **US2 (Update)**: T046 (detection) can run parallel with T047 (CalDAV update method)
-   **US3 (Bidirectional)**: T052, T053 (CalDAV fetching/parsing) can run parallel with T055 (vault writer)
-   **US6 (Filters)**: T061-T064 (UI) can run parallel with T065-T067 (filter logic)
-   **Polish (Phase 9)**: T072-T082 can run in parallel (different concerns)

---

## Parallel Example: User Story 1 (Initial Sync)

```bash
# Launch vault scanning and parsing together:
Task T033: "Implement vault scanner in src/vault/scanner.ts"
Task T034: "Implement task parser in src/vault/taskParser.ts"

# While those are in progress, also work on:
Task T037: "Implement VTODO converter in src/caldav/vtodo.ts"

# These three can be developed independently and integrated later in T040
```

---

## Parallel Example: User Story 6 (Filters)

```bash
# Launch UI work in parallel with filter logic:
Task T061-T064: "Add filter settings UI in src/ui/settingsTab.ts"

# While UI is being built, implement filter methods:
Task T065: "Folder exclusion check in src/sync/filters.ts"
Task T066: "Tag exclusion check in src/sync/filters.ts"
Task T067: "Age threshold check in src/sync/filters.ts"

# These can be developed independently and integrated at T068-T069
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. ✅ Complete Phase 1: Setup (T001-T006)
2. ✅ Complete Phase 2: Foundational (T007-T013) - CRITICAL BLOCKER
3. ✅ Complete US4: Configure CalDAV Connection (T014-T023)
4. ✅ Complete US5: Configure Auto-Sync Interval (T024-T032)
5. ✅ Complete US1: Initial Task Sync (T033-T045)
6. **STOP and VALIDATE**: Test MVP independently with real CalDAV server
7. Deploy/demo if ready

**MVP Scope**: At this point, users can configure CalDAV connection, set sync interval, and sync tasks from Obsidian to CalDAV automatically. This is a complete, valuable feature.

### Incremental Delivery

1. **MVP Release** (P1 stories: US4, US5, US1): Basic one-way sync with auto-sync
2. **Update Release** (Add US2): Enable Obsidian task updates to flow to CalDAV
3. **Bidirectional Release** (Add US3): Full bidirectional sync
4. **Filter Release** (Add US6): Advanced filtering capabilities
5. **Polish Release** (Phase 9): Production-ready with error handling and optimization

Each release adds value without breaking previous functionality.

### Parallel Team Strategy

With multiple developers after Foundational phase completes:

1. **Team completes Setup + Foundational together** (T001-T013)
2. Once Foundational is done:
    - **Developer A**: US4 (Configure CalDAV) → T014-T023
    - **Developer B**: US5 (Configure Auto-Sync) → T024-T032 (can start parallel to A)
    - **Developer A+B**: US1 (Initial Sync) → T033-T045 (requires both US4 and US5)
3. After US1 MVP:
    - **Developer A**: US2 (Update Obsidian→CalDAV) → T046-T051
    - **Developer B**: US3 (Update CalDAV→Obsidian) → T052-T060
    - **Developer C**: US6 (Filters) → T061-T071 (can start parallel to A/B)
4. All converge on Phase 9: Polish

---

## Task Summary

**Total Tasks**: 85

### Tasks by Phase

-   **Phase 1 (Setup)**: 6 tasks
-   **Phase 2 (Foundational)**: 7 tasks (BLOCKING)
-   **Phase 3 (US4 - Configure CalDAV)**: 10 tasks (P1 - MVP Required)
-   **Phase 4 (US5 - Configure Auto-Sync)**: 9 tasks (P1 - MVP Required)
-   **Phase 5 (US1 - Initial Sync)**: 13 tasks (P1 - MVP)
-   **Phase 6 (US2 - Update Obsidian→CalDAV)**: 6 tasks (P2)
-   **Phase 7 (US3 - Update CalDAV→Obsidian)**: 9 tasks (P3)
-   **Phase 8 (US6 - Filters)**: 11 tasks (P2)
-   **Phase 9 (Polish)**: 14 tasks

### Tasks by User Story

-   **US1 (Initial Sync)**: 13 tasks
-   **US2 (Update Obsidian→CalDAV)**: 6 tasks
-   **US3 (Update CalDAV→Obsidian)**: 9 tasks
-   **US4 (Configure CalDAV)**: 10 tasks
-   **US5 (Configure Auto-Sync)**: 9 tasks
-   **US6 (Filters)**: 11 tasks
-   **Infrastructure (Setup + Foundational)**: 13 tasks
-   **Polish (Cross-cutting)**: 14 tasks

### Parallel Opportunities Identified

-   **Setup**: 4 parallelizable tasks
-   **Foundational**: 4 parallelizable tasks
-   **Per User Story**: 15-20 parallelizable tasks across all stories
-   **Polish**: 11 parallelizable tasks

### MVP Scope (P1 Stories)

**MVP = Setup + Foundational + US4 + US5 + US1 = 45 tasks (T001-T045)**

This delivers: CalDAV configuration, automatic sync scheduling, and initial task sync from Obsidian to CalDAV.

---

## Notes

-   **[P] tasks**: Different files, no dependencies - can run in parallel
-   **[Story] label**: Maps task to specific user story for traceability (US1-US6)
-   Each user story is independently completable and testable
-   Stop at any checkpoint to validate story independently
-   Commit after each task or logical group
-   All file paths are relative to repository root
-   Constitution compliance checked throughout (modularity, security, performance)
-   Mobile compatibility required (test on iOS/Android)
-   No tests generated (not requested in specification)

---

**Generated**: 2026-01-08
**Based on**: spec.md (6 user stories), plan.md, data-model.md, contracts/caldav-api.md, research.md
**Format**: Tasks Template v1.0

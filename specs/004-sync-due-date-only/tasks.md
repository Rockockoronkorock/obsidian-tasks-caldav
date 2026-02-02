# Tasks: Due Date Filter for Task Synchronization

**Input**: Design documents from `/specs/004-sync-due-date-only/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/filter-api.ts

**Tests**: Tests are included as this is a critical filtering feature that requires validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Verify development environment with TypeScript 5.8.3 and Obsidian API ^1.11.4
- [x] T002 Create feature branch `004-sync-due-date-only` from main
- [x] T003 Review existing filter system in src/sync/filters.ts for integration points

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core configuration changes that MUST be complete before user stories can be implemented

**⚠️ CRITICAL**: All user story work depends on these configuration changes being complete

- [x] T004 [P] Add `syncOnlyTasksWithDueDate: boolean` field to CalDAVConfiguration interface in src/types.ts
- [x] T005 [P] Add `syncOnlyTasksWithDueDate: false` default value to DEFAULT_SETTINGS in src/settings.ts

**Checkpoint**: Configuration foundation ready - user story implementation can now begin

---

## Phase 3: User Story 3 - Configure Due Date Filter Setting (Priority: P1) 🎯 FOUNDATIONAL

**Goal**: Enable users to configure the due date filter through the plugin settings UI, giving them control over sync behavior

**Independent Test**: Access plugin settings, toggle the due date filter option, verify that the setting is persisted across Obsidian restarts

### Implementation for User Story 3

- [x] T006 [US3] Add checkbox setting to settings UI in src/ui/settingsTab.ts with name "Sync only tasks with due dates" and description explaining behavior
- [x] T007 [US3] Implement onChange handler to save settings when checkbox is toggled in src/ui/settingsTab.ts
- [x] T008 [US3] Add getValue binding to read current setting value from plugin settings in src/ui/settingsTab.ts

**Checkpoint**: Settings UI is complete and functional. Users can now enable/disable the filter, though filtering logic is not yet implemented.

---

## Phase 4: User Story 1 - Enable Due Date Filter for New Tasks (Priority: P1) 🎯 MVP CORE

**Goal**: Allow users to sync only tasks that have due dates to their CalDAV server, reducing clutter from open-ended tasks

**Independent Test**: Enable the configuration option, create tasks with and without due dates (📅 YYYY-MM-DD format), verify that only tasks with due dates are synced to CalDAV

### Implementation for User Story 1

- [x] T015 [US1] Add helper function `hasSyncMapping(task: Task, mappings: Map<string, SyncMapping>): boolean` in src/sync/filters.ts
- [x] T016 [US1] Update `shouldSync` function signature to add `mappings: Map<string, SyncMapping>` parameter in src/sync/filters.ts
- [x] T017 [US1] Add due date filter logic at start of shouldSync function checking `config.syncOnlyTasksWithDueDate` and `task.dueDate` in src/sync/filters.ts
- [x] T018 [US1] Update all call sites of `shouldSync()` in src/sync/engine.ts to pass the mappings parameter

**Checkpoint**: User Story 1 is complete. The due date filter works for new tasks - only tasks with due dates are synced when the filter is enabled.

---

## Phase 5: User Story 2 - Maintain Legacy Sync for Previously Synced Tasks (Priority: P2)

**Goal**: Preserve sync relationships for tasks that were previously synced, even when their due date is removed, preventing data loss for existing users

**Independent Test**: Sync a task with a due date while filter is enabled, then remove the due date and verify the task continues to sync (identified by block ID presence in sync mappings)

### Implementation for User Story 2

- [x] T026 [US2] Update due date filter logic in shouldSync to check `hasSyncMapping(task, mappings)` for exception case in src/sync/filters.ts
- [x] T027 [US2] Add fail-safe logic: treat missing blockId as empty string (never synced) in src/sync/filters.ts

**Checkpoint**: User Story 2 is complete. Previously synced tasks continue to sync even when due date is removed, preserving data integrity.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, testing, and quality assurance across all user stories

**Note**: Manual testing tasks should be performed by the user to validate the implementation in a real Obsidian environment.

- [ ] T035 Manual testing: Create test vault with tasks with/without due dates, verify sync behavior matches acceptance scenarios
- [ ] T036 Manual testing: Toggle setting on/off, verify all scenarios from quickstart.md validation section
- [ ] T037 Manual testing: Test settings persistence by reloading Obsidian and verifying configuration persists
- [ ] T038 Performance validation: Run sync on vault with 1000+ tasks, verify filter overhead is <0.1ms total
- [ ] T039 Backward compatibility testing: Test with old data.json files without `syncOnlyTasksWithDueDate` field
- [x] T040 Constitution compliance review: Verify all 5 principles (modularity, security, versioning, performance, Obsidian policy)
- [x] T041 Update CLAUDE.md with completed feature information if needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) - BLOCKS all user stories
- **User Story 3 (Phase 3)**: Depends on Foundational (Phase 2) - Settings UI needs config fields
- **User Story 1 (Phase 4)**: Depends on Foundational (Phase 2) and User Story 3 (Phase 3) - Core filtering needs config
- **User Story 2 (Phase 5)**: Depends on User Story 1 (Phase 4) - Extends core filtering with exception logic
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 3 (P1)**: Settings UI - Can start after Foundational phase complete
- **User Story 1 (P1)**: Core filtering - Requires User Story 3 (needs settings to enable filter)
- **User Story 2 (P2)**: Legacy sync exception - Requires User Story 1 (extends the filter logic)

**Note**: While User Story 3 and User Story 1 are both P1, US3 must complete first as it provides the settings UI needed to enable the filter. US1 delivers the core MVP value (filtering by due date).

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Helper functions before main filter logic
- Filter logic before call site updates
- Unit tests before integration tests
- Tests pass before moving to next story

### Parallel Opportunities

- T004 and T005 (Foundational phase) can run in parallel (different files)
- T009, T010, T011, T012, T013 (US1 test creation) can run in parallel (independent test cases)
- T020 and T021 (US1 integration tests) can run in parallel (independent test scenarios)
- T023 and T024 (US2 unit tests) can run in parallel (independent test cases)
- T032 and T033 (Polish edge case tests) can run in parallel (independent test cases)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all unit tests for User Story 1 together:
Task: "Create unit test file tests/unit/filters.test.ts with test infrastructure and imports"
Task: "Add unit test 'when filter is disabled, should sync tasks with due dates' in tests/unit/filters.test.ts"
Task: "Add unit test 'when filter is disabled, should sync tasks without due dates' in tests/unit/filters.test.ts"
Task: "Add unit test 'when filter is enabled, should sync tasks with due dates' in tests/unit/filters.test.ts"
Task: "Add unit test 'when filter is enabled, should NOT sync tasks without due dates' in tests/unit/filters.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 3 + 1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (config fields)
3. Complete Phase 3: User Story 3 (Settings UI)
4. Complete Phase 4: User Story 1 (Core filtering)
5. **STOP and VALIDATE**: Test filtering works for new tasks with/without due dates
6. Deploy/demo if ready (MVP delivers value: users can filter tasks by due date)

### Incremental Delivery

1. Complete Setup + Foundational → Configuration ready
2. Add User Story 3 → Settings UI functional → Users can toggle setting
3. Add User Story 1 → Core filtering works → **MVP READY** (filter by due date)
4. Add User Story 2 → Legacy sync preserved → Data integrity complete
5. Complete Polish → Production ready

### Suggested MVP Scope

**Minimum Viable Product**: User Story 3 + User Story 1

- Users can enable the filter via settings
- Only tasks with due dates sync to CalDAV
- This delivers the core value proposition

**Full Feature**: Add User Story 2

- Previously synced tasks continue to sync
- Prevents data loss and confusion
- Production-ready implementation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests are REQUIRED (this is a critical filtering feature)
- Each user story should be independently testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Performance target: <100ns overhead per task, <0.1ms total for 1000 tasks
- Backward compatibility: Default setting is `false` (no behavior change for existing users)

# Implementation Tasks: Obsidian Link Sync to CalDAV

**Feature**: 003-obsidian-link-sync | **Branch**: `003-obsidian-link-sync` | **Date**: 2026-01-23

## Overview

This document provides actionable implementation tasks for the Obsidian Link Sync feature, organized by user story for independent implementation and testing. The feature enables users to access Obsidian task context directly from CalDAV clients by appending clickable Obsidian URIs to the DESCRIPTION field during initial task sync.

**Tech Stack**:
- TypeScript 5.8.3 with strict mode
- Obsidian API (latest)
- Target Platform: Obsidian Desktop and Mobile

**Estimated Total Time**: 3-4 hours

---

## Implementation Strategy

### MVP Scope (Recommended First Iteration)
- **User Story 1 only**: Quick Task Context Access from CalDAV Client
- Delivers immediate value with minimal implementation
- Can be tested end-to-end independently
- Time estimate: 3-4 hours

### Incremental Delivery
1. **Phase 1**: Setup (prepare project structure) - 5 minutes
2. **Phase 2**: Foundational (core URI generation module) - 45 minutes
3. **Phase 3**: User Story 1 (P1) - Core feature - 2 hours
4. **Phase 4**: User Story 2 (P2) - Mobile optimization - 30 minutes
5. **Phase 5**: Polish - Quality assurance - 30 minutes

### Why This Structure Works
- Each user story is independently testable
- User Story 1 can ship without User Story 2
- Mobile testing (US2) builds on desktop foundation (US1)
- Enables early feedback on core functionality

---

## Phase 1: Setup

**Goal**: Prepare project structure for new feature implementation.

**Duration**: ~5 minutes

### Tasks

- [X] T001 Verify current branch is `003-obsidian-link-sync` and working directory is clean
- [X] T002 Create new directory `src/obsidian/` for Obsidian-specific utilities
- [X] T003 [P] Run TypeScript compiler to ensure baseline compiles: `npm run build`
- [X] T004 [P] Run linter to ensure baseline passes: `npm run lint` (NOTE: Baseline has pre-existing linting issues unrelated to this feature)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Goal**: Implement core URI generation module that all user stories depend on.

**Duration**: ~45 minutes

**Why Foundational**: This module is required by both User Story 1 and User Story 2. Must be complete before implementing any user story.

### Tasks

- [X] T005 Create `src/obsidian/uriBuilder.ts` with module skeleton (imports, exports)
- [X] T006 [P] Implement `isValidBlockId()` function in `src/obsidian/uriBuilder.ts` with UUID validation regex
- [X] T007 [P] Implement `buildObsidianURI()` function in `src/obsidian/uriBuilder.ts` with input validation and URL encoding
- [X] T008 [P] Implement `buildDescriptionWithURI()` function in `src/obsidian/uriBuilder.ts` to format DESCRIPTION content
- [X] T009 Add JSDoc comments to all exported functions in `src/obsidian/uriBuilder.ts`
- [X] T010 Verify TypeScript compilation succeeds: `npm run build`

**Completion Criteria**:
- `uriBuilder.ts` module exists with 3 exported functions
- TypeScript compilation passes
- Functions have proper type signatures and JSDoc comments

---

## Phase 3: User Story 1 - Quick Task Context Access from CalDAV Client (P1)

**Story Goal**: Enable users to click Obsidian URIs in CalDAV clients (Apple Calendar, Google Calendar, Thunderbird) to jump directly to the source note in Obsidian.

**Why P1**: Core value proposition - seamless context switching between CalDAV clients and Obsidian.

**Duration**: ~2 hours

**Independent Test Criteria**:
1. Create a task in Obsidian with a block ID
2. Sync to CalDAV
3. Open task in any CalDAV client
4. Verify DESCRIPTION field contains properly formatted Obsidian URI
5. Click URI in CalDAV client
6. Verify Obsidian launches and navigates to correct note and task location
7. Update task in Obsidian and re-sync
8. Verify DESCRIPTION field remains unchanged in CalDAV

### Implementation Tasks

- [X] T011 [US1] Add import statement for URI builder functions in `src/sync/engine.ts`
- [X] T012 [US1] Locate `createTaskOnCalDAV()` method in `src/sync/engine.ts` (approximately line 511-540)
- [X] T013 [US1] Add URI generation logic with try-catch error handling in `createTaskOnCalDAV()` method in `src/sync/engine.ts`
- [X] T014 [US1] Add vault name retrieval via `this.vault.getName()` in `createTaskOnCalDAV()` in `src/sync/engine.ts`
- [X] T015 [US1] Add block ID validation check before URI generation in `createTaskOnCalDAV()` in `src/sync/engine.ts`
- [X] T016 [US1] Call `buildObsidianURI()` and `buildDescriptionWithURI()` in `createTaskOnCalDAV()` in `src/sync/engine.ts`
- [X] T017 [US1] Pass optional `description` parameter to `this.caldavClient.createTask()` in `src/sync/engine.ts`
- [X] T018 [US1] Add appropriate console.warn() logging for URI generation failures in `src/sync/engine.ts`
- [X] T019 [US1] Locate `createTask()` method in `src/caldav/client.ts` (approximately line 374-435)
- [X] T020 [US1] Add optional `description?: string` parameter to `createTask()` method signature in `src/caldav/client.ts`
- [X] T021 [US1] Verify `escapeText()` function is imported from `src/caldav/vtodo.ts` in `src/caldav/client.ts`
- [X] T022 [US1] Add conditional DESCRIPTION field insertion in VTODO construction in `createTask()` in `src/caldav/client.ts`
- [X] T023 [US1] Apply `escapeText()` to description parameter before adding to VTODO in `src/caldav/client.ts`
- [X] T024 [US1] Verify TypeScript compilation succeeds after changes: `npm run build`
- [ ] T025 [US1] Verify linting passes after changes: `npm run lint` (Skipped - baseline has pre-existing linting issues)

### Verification Tasks

- [X] T026 [P] [US1] Read `updateVTODOProperties()` function in `src/caldav/vtodo.ts` (line ~187-274) and confirm DESCRIPTION is NOT in update list
- [X] T027 [P] [US1] Verify property preservation pattern: existing VTODO is fetched before updates in `updateTaskWithPreservation()`
- [X] T028 [P] [US1] Confirm backward compatibility: calls to `createTask()` without description parameter still compile

### Manual Testing Tasks

- [ ] T029 [US1] Setup: Configure CalDAV test server (Nextcloud, Radicale, or iCloud)
- [ ] T030 [US1] Setup: Create dev vault with test tasks
- [ ] T031 [US1] Setup: Enable plugin hot-reload with `npm run dev`
- [ ] T032 [US1] Test: Create task in Obsidian with format `- [ ] Test task 📅 2026-01-30`
- [ ] T033 [US1] Test: Trigger sync to CalDAV server
- [ ] T034 [US1] Test: Open task in CalDAV client and verify DESCRIPTION contains `Obsidian Link: obsidian://...`
- [ ] T035 [US1] Test: Verify URI in DESCRIPTION is clickable in CalDAV client
- [ ] T036 [US1] Test: Click URI and verify Obsidian launches to correct vault
- [ ] T037 [US1] Test: Verify Obsidian navigates to correct note and task block location
- [ ] T038 [US1] Test: Create multiple tasks from same Obsidian note and verify each has unique URI
- [ ] T039 [US1] Test: Update existing synced task in Obsidian (change status to completed)
- [ ] T040 [US1] Test: Re-sync and verify DESCRIPTION field in CalDAV remains unchanged
- [ ] T041 [US1] Test: Verify task status updated correctly while DESCRIPTION preserved

### Edge Case Testing Tasks

- [ ] T042 [P] [US1] Test: Create task in vault with spaces in name (e.g., "My Work Vault") and verify URI encoding
- [ ] T043 [P] [US1] Test: Create task in file path with spaces (e.g., "Projects/Q1 Planning/tasks.md") and verify URI encoding
- [ ] T044 [P] [US1] Test: Create task in file path with special chars (e.g., "Tasks & Goals (2024).md") and verify URI encoding
- [ ] T045 [P] [US1] Test: Create task in file with Unicode characters (e.g., emojis, non-ASCII) and verify URI encoding
- [ ] T046 [P] [US1] Test: Create task without block ID and verify sync succeeds WITHOUT URI, warning logged to console
- [ ] T047 [P] [US1] Test: Verify no console errors during normal sync operation

**User Story 1 Acceptance**:
- ✅ Tasks sync from Obsidian to CalDAV with URIs in DESCRIPTION field
- ✅ URIs are clickable in Apple Calendar, Google Calendar, or Thunderbird
- ✅ Clicking URI launches Obsidian and navigates to correct note + task block
- ✅ Multiple tasks from same note have unique URIs
- ✅ DESCRIPTION field remains unchanged after initial sync (property preservation works)
- ✅ Edge cases handled: spaces, special chars, Unicode, missing block IDs

---

## Phase 4: User Story 2 - Mobile Workflow Optimization (P2)

**Story Goal**: Enable mobile users (iOS/Android) to tap Obsidian URIs in mobile calendar apps to seamlessly switch to Obsidian mobile and view task context.

**Why P2**: Mobile workflows are common for task management. Builds on P1 by testing mobile-specific behavior.

**Duration**: ~30 minutes

**Independent Test Criteria**:
1. Sync a task from Obsidian Desktop to CalDAV
2. Open task in iOS Calendar/Reminders or Android Google Calendar/Tasks
3. Tap Obsidian URI in task description
4. Verify Obsidian mobile app launches
5. Verify app navigates to correct note and task location

**Prerequisites**: User Story 1 must be complete (desktop implementation)

### Mobile Testing Tasks

- [ ] T048 [US2] Test: Install Obsidian app on iOS device and configure same vault
- [ ] T049 [US2] Test: Sync task to CalDAV from desktop Obsidian
- [ ] T050 [US2] Test: Open task in Apple Calendar or Reminders on iOS
- [ ] T051 [US2] Test: Tap Obsidian URI and verify Obsidian iOS app opens
- [ ] T052 [US2] Test: Verify Obsidian iOS displays correct note with task highlighted
- [ ] T053 [P] [US2] Test: Install Obsidian app on Android device and configure same vault
- [ ] T054 [P] [US2] Test: Open task in Google Calendar or Google Tasks on Android
- [ ] T055 [P] [US2] Test: Tap Obsidian URI and verify Obsidian Android app opens
- [ ] T056 [P] [US2] Test: Verify Obsidian Android navigates to correct note

**User Story 2 Acceptance**:
- ✅ Obsidian URIs are tappable on iOS in Apple Calendar/Reminders
- ✅ Tapping URI launches Obsidian iOS app to correct note
- ✅ Obsidian URIs are tappable on Android in Google Calendar/Tasks
- ✅ Tapping URI launches Obsidian Android app to correct note

---

## Phase 5: Polish & Cross-Cutting Concerns

**Goal**: Final quality assurance and documentation.

**Duration**: ~30 minutes

### Quality Assurance Tasks

- [ ] T057 Run full TypeScript build and verify no errors: `npm run build`
- [ ] T058 Run linter and verify no warnings: `npm run lint`
- [ ] T059 Review console logs during sync and ensure no errors or unexpected warnings
- [ ] T060 Verify backward compatibility: existing tasks without URIs continue syncing correctly
- [ ] T061 [P] Performance check: Verify sync of 10 tasks completes in reasonable time (<1 second overhead for URI generation)
- [ ] T062 [P] Performance check: Add timing log to `createTaskOnCalDAV()` and verify URI generation <5ms per task

### Code Review Tasks

- [ ] T063 Review `src/obsidian/uriBuilder.ts` for code quality and adherence to TypeScript strict mode
- [ ] T064 Review `src/sync/engine.ts` changes for proper error handling and graceful degradation
- [ ] T065 Review `src/caldav/client.ts` changes for proper RFC 5545 escaping and VTODO format
- [ ] T066 Verify all functions have appropriate JSDoc comments
- [ ] T067 Verify error messages are clear and actionable for debugging

### Documentation Tasks

- [ ] T068 Add inline code comments explaining URI generation logic in `src/sync/engine.ts`
- [ ] T069 Add inline code comments explaining DESCRIPTION field handling in `src/caldav/client.ts`
- [ ] T070 Update README.md with feature description and usage instructions (if applicable)
- [ ] T071 Document known limitations: URIs don't update if files move after initial sync

**Phase 5 Acceptance**:
- ✅ Build and lint pass without errors
- ✅ No console errors during sync operations
- ✅ Performance requirements met (<5ms per task)
- ✅ Code is well-documented with comments
- ✅ Backward compatibility maintained

---

## Dependencies & Execution Order

### User Story Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational - URI Builder Module)
    ↓
    ├─→ Phase 3 (User Story 1 - Desktop) ✅ MVP - Can ship independently
    │       ↓
    │   Phase 4 (User Story 2 - Mobile) - Builds on User Story 1
    │
    └─→ Phase 5 (Polish) - Final QA
```

**Key Insights**:
- User Story 1 is **independent and shippable** after Phase 2 completion
- User Story 2 **depends on** User Story 1 (uses same codebase, adds mobile testing)
- Phase 5 can run in parallel with final user story testing

### Critical Path
1. Phase 1: Setup (T001-T004)
2. Phase 2: Foundational (T005-T010) - **BLOCKS all user stories**
3. Phase 3: User Story 1 (T011-T047) - **MVP deliverable**
4. Phase 4: User Story 2 (T048-T056) - Optional enhancement
5. Phase 5: Polish (T057-T071) - Quality gate

---

## Parallel Execution Opportunities

### Within Phase 2 (Foundational)
After T005 (create module skeleton), these tasks can run in parallel:
- T006: Implement `isValidBlockId()`
- T007: Implement `buildObsidianURI()`
- T008: Implement `buildDescriptionWithURI()`

### Within Phase 3 (User Story 1)
After T011-T018 (sync engine changes) are complete, these can run in parallel:
- T019-T023: CalDAV client modifications
- T024: TypeScript compilation check
- T025: Linting check

After implementation (T011-T025), these verification tasks can run in parallel:
- T026: Review property preservation
- T027: Verify update pattern
- T028: Confirm backward compatibility

Edge case tests (T042-T047) can all run in parallel after basic testing (T032-T041) completes.

### Within Phase 4 (User Story 2)
iOS tests (T048-T052) and Android tests (T053-T056) can run in parallel if you have access to both device types.

### Within Phase 5 (Polish)
Performance checks (T061-T062) can run in parallel with documentation tasks (T068-T071).

---

## Task Summary

| Phase | Task Count | Duration | Parallel Opportunities |
|-------|------------|----------|----------------------|
| Phase 1: Setup | 4 tasks | 5 min | T003-T004 (build/lint) |
| Phase 2: Foundational | 6 tasks | 45 min | T006-T008 (function implementations) |
| Phase 3: User Story 1 | 37 tasks | 2 hours | T019-T025, T026-T028, T042-T047 |
| Phase 4: User Story 2 | 9 tasks | 30 min | T048-T052 (iOS) + T053-T056 (Android) |
| Phase 5: Polish | 15 tasks | 30 min | T061-T062, T068-T071 |
| **Total** | **71 tasks** | **3-4 hours** | **~15 tasks can be parallelized** |

---

## MVP Recommendation

**Recommended MVP**: Phase 1 + Phase 2 + Phase 3 (User Story 1)
- **Tasks**: T001-T047 (47 tasks)
- **Time**: ~3 hours
- **Value**: Complete desktop workflow with CalDAV URI syncing
- **Testable**: Fully independently testable on desktop
- **Shippable**: Can release without Phase 4 (mobile testing)

**Phase 4 (User Story 2)** can be added in a subsequent iteration if mobile testing infrastructure is available.

---

## Definition of Done

### Per User Story
- [ ] All tasks for the user story completed
- [ ] All acceptance scenarios from spec.md validated
- [ ] Independent test criteria verified
- [ ] No regressions in existing functionality

### Overall Feature
- [ ] TypeScript compilation succeeds: `npm run build`
- [ ] Linting passes: `npm run lint`
- [ ] User Story 1 acceptance criteria met (minimum for MVP)
- [ ] User Story 2 acceptance criteria met (optional, for full release)
- [ ] Performance requirements met (<5ms per task)
- [ ] No console errors during sync
- [ ] Backward compatibility maintained
- [ ] Code is well-documented

---

## Risk Mitigation

### Technical Risks

1. **Risk**: CalDAV server doesn't support DESCRIPTION field
   - **Mitigation**: DESCRIPTION is RFC 5545 standard, universally supported. Test with multiple servers (Nextcloud, iCloud, Radicale) early.
   - **Tasks**: T029, T033-T034

2. **Risk**: Property preservation doesn't work as expected
   - **Mitigation**: Verify existing implementation before making changes (T026-T027). Test early with update scenario (T039-T041).

3. **Risk**: URI encoding breaks on edge cases
   - **Mitigation**: Comprehensive edge case testing (T042-T047) with spaces, special chars, Unicode.

4. **Risk**: Mobile apps don't register obsidian:// URI scheme
   - **Mitigation**: User Story 2 is P2 (optional). Test early on mobile devices (T048-T056).

### Process Risks

1. **Risk**: No CalDAV test server available
   - **Mitigation**: Use free options: iCloud (Apple ID), Nextcloud demo instance, or local Radicale setup.
   - **Blockers**: T029 (setup)

2. **Risk**: No mobile device available for testing
   - **Mitigation**: Phase 4 (User Story 2) is optional for MVP. Can ship with desktop-only validation.
   - **Impact**: Skip T048-T056

---

## Testing Checklist Reference

### From spec.md Acceptance Scenarios

**User Story 1**:
- [x] Task synced to CalDAV contains properly formatted URI (T034)
- [x] URI is clickable in CalDAV client (T035)
- [x] Clicking URI launches Obsidian to correct note (T036-T037)
- [x] Multiple tasks have unique URIs (T038)
- [x] DESCRIPTION unchanged after re-sync (T039-T041)

**User Story 2**:
- [x] URI tappable on iOS and launches Obsidian iOS (T048-T052)
- [x] URI tappable on Android and launches Obsidian Android (T053-T056)

### From spec.md Edge Cases
- [x] Special characters in file paths (T043-T044)
- [x] Spaces in vault names (T042)
- [x] Unicode characters (T045)
- [x] Missing block ID (T046)

---

## Notes

- **No automated tests**: Project currently uses manual testing. All tests are manual verification tasks.
- **Property preservation**: Existing pattern in `updateVTODOProperties()` already handles DESCRIPTION. No changes needed to `src/caldav/vtodo.ts`.
- **Error handling**: Graceful degradation - URI generation failures should log warnings but not block task sync.
- **Performance**: <5ms per task is the target. Measure with T062 if performance issues arise.
- **Backward compatibility**: Critical - existing tasks must continue syncing without URIs if block ID is missing.

---

**Next Steps**: Begin with Phase 1 (Setup) tasks T001-T004, then proceed to Phase 2 (Foundational) to build the URI generation module.

# Feature Specification: Due Date Filter for Task Synchronization

**Feature Branch**: `004-sync-due-date-only`
**Created**: 2026-02-02
**Status**: Draft
**Input**: User description: "Introduce a new configuration option which enables to sync tasks only if they have a due date. If they were already synced and due date gets removed it should continue to sync (checking for block id)."

## Clarifications

### Session 2026-02-02

- Q: Where is the block ID stored and what format does it take in the context of one-way sync (Obsidian → CalDAV)? → A: Block IDs are inline identifiers in Obsidian task markdown (e.g., `^abc123`)
- Q: What format are due dates stored in within Obsidian task markdown? → A: Emoji-based format: 📅 YYYY-MM-DD (Obsidian Tasks plugin standard)
- Q: What is the scope of tasks that should be evaluated for syncing? → A: All tasks across the entire vault
- Q: When a task is deleted from Obsidian that has been synced to CalDAV, what should happen on the CalDAV side? → A: No action - manual cleanup required on CalDAV side

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enable Due Date Filter for New Tasks (Priority: P1)

A user wants to sync only tasks that have due dates to their CalDAV server, reducing clutter from open-ended tasks and focusing their external calendar on time-sensitive items.

**Why this priority**: This is the core functionality that delivers immediate value by allowing users to control which tasks are synced based on due dates, which is the primary use case for this feature.

**Independent Test**: Can be fully tested by enabling the configuration option, creating tasks with and without due dates, and verifying that only tasks with due dates are synced to CalDAV. This delivers standalone value even without the legacy sync behavior.

**Acceptance Scenarios**:

1. **Given** the due date filter option is disabled (default), **When** a user creates a task without a due date, **Then** the task is synced to CalDAV
2. **Given** the due date filter option is enabled, **When** a user creates a task with a due date, **Then** the task is synced to CalDAV
3. **Given** the due date filter option is enabled, **When** a user creates a task without a due date, **Then** the task is NOT synced to CalDAV

---

### User Story 2 - Maintain Legacy Sync for Previously Synced Tasks (Priority: P2)

A user who has already synced tasks to CalDAV removes the due date from some tasks but still wants those specific tasks to continue syncing, preserving the sync relationship established when the task had a due date.

**Why this priority**: This prevents data loss and unexpected behavior for existing users, but is secondary to the core filtering functionality since it only affects tasks that were previously synced.

**Independent Test**: Can be tested by syncing a task with a due date while the filter is enabled, then removing the due date and verifying the task continues to sync. This demonstrates backward compatibility and data integrity.

**Acceptance Scenarios**:

1. **Given** the due date filter option is enabled and a task with a due date has been synced (has a block ID), **When** the user removes the due date from that task, **Then** the task continues to sync to CalDAV
2. **Given** the due date filter option is enabled and a task with a due date has been synced (has a block ID), **When** the user modifies the task content but keeps the due date removed, **Then** the changes are synced to CalDAV
3. **Given** the due date filter option is enabled and a task has never been synced (no block ID), **When** the user creates the task without a due date, **Then** the task is not synced to CalDAV even if later modified

---

### User Story 3 - Configure Due Date Filter Setting (Priority: P1)

A user wants to enable or disable the due date filter through the plugin settings, giving them control over sync behavior without requiring technical knowledge.

**Why this priority**: This is essential infrastructure for the feature to be usable. Without a configuration interface, users cannot access the filtering functionality. It's P1 because it's required for Story 1 to work.

**Independent Test**: Can be tested by accessing the plugin settings, toggling the due date filter option, and verifying that the setting is persisted across Obsidian restarts.

**Acceptance Scenarios**:

1. **Given** the user opens plugin settings, **When** they view the sync settings section, **Then** they see a clearly labeled option to enable/disable the due date filter
2. **Given** the user toggles the due date filter setting, **When** they close and reopen Obsidian, **Then** the setting remains as configured
3. **Given** the plugin is installed for the first time, **When** the user views settings, **Then** the due date filter is disabled by default to maintain backward compatibility

---

### Edge Cases

- What happens when a task's due date is changed (not removed, but modified) while the filter is enabled and the task is already synced?
- How does the system handle tasks that are synced, then the due date is removed, then a due date is added again?
- What happens if a user disables the due date filter after using it - do previously unsynced tasks (that have no due date and no block ID) now get synced?
- How does the system identify previously synced tasks - what constitutes a valid block ID?
- What happens when a task is deleted from Obsidian - does it remain on CalDAV requiring manual cleanup?
- How should the system handle tasks with malformed date formats (e.g., incorrect emoji or date pattern)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a configuration option in plugin settings to enable/disable the due date filter for task synchronization
- **FR-002**: System MUST evaluate all tasks across the entire vault for synchronization to CalDAV
- **FR-003**: System MUST sync only tasks that have a due date (in 📅 YYYY-MM-DD format) when the due date filter is enabled
- **FR-004**: System MUST continue to sync tasks that were previously synced (identified by block ID) even if their due date is removed, when the filter is enabled
- **FR-005**: System MUST use the block ID to identify whether a task has been previously synced to CalDAV
- **FR-006**: System MUST sync all tasks regardless of due date when the due date filter is disabled (backward compatible behavior)
- **FR-007**: System MUST persist the due date filter setting across application restarts
- **FR-008**: System MUST default the due date filter to disabled for new installations to maintain backward compatibility
- **FR-009**: System MUST allow users to modify previously synced tasks (those with block IDs but no due date) and continue syncing the changes when the filter is enabled
- **FR-010**: System MUST NOT retroactively sync tasks without due dates and without block IDs when the filter is disabled after being enabled
- **FR-011**: System MUST NOT automatically delete tasks from CalDAV when they are deleted from Obsidian (manual cleanup required on CalDAV side)

### Key Entities

- **Task**: Represents an Obsidian task with properties including content, due date (optional, in 📅 YYYY-MM-DD format), and block ID (optional). The block ID is an inline identifier in the task markdown (e.g., `^abc123`) that indicates the task has been synced to CalDAV at least once.
- **Configuration Setting**: Represents the due date filter toggle state (enabled/disabled), persisted in plugin settings with a default value of disabled.
- **Sync State**: Represents the synchronization relationship between a local task and its CalDAV counterpart, identified by the presence of a block ID.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully enable the due date filter and verify that only tasks with due dates are synced to CalDAV within 30 seconds of task creation
- **SC-002**: Tasks that were previously synced continue to sync after due date removal, maintaining 100% data consistency between Obsidian and CalDAV
- **SC-003**: The configuration setting persists across application restarts with 100% reliability
- **SC-004**: The feature maintains backward compatibility - users who do not enable the filter experience no change in sync behavior
- **SC-005**: Users can toggle the setting and observe the expected sync behavior change within the next sync cycle (typically under 1 minute)

## Assumptions

- All tasks across the entire vault are evaluated for synchronization (no folder-based or tag-based filtering)
- Block ID is the existing mechanism used by the plugin to track sync relationships between Obsidian tasks and CalDAV items, stored as inline identifiers in the task markdown (e.g., `^abc123`)
- The due date filter applies to the initial sync decision only - once a task is synced (has a block ID), it continues to sync regardless of due date presence
- Disabling the filter after use does not retroactively sync tasks that were excluded while the filter was enabled
- The plugin already has a settings interface where this new option can be added
- Due dates are stored in the Obsidian Tasks plugin standard format (📅 YYYY-MM-DD) that the plugin can reliably detect as present or absent
- Task deletion in Obsidian does not trigger deletion on CalDAV - users must manually clean up tasks on the CalDAV server if desired

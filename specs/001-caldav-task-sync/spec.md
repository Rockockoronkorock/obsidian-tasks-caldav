# Feature Specification: CalDAV Task Synchronization

**Feature Branch**: `001-caldav-task-sync`
**Created**: 2026-01-08
**Status**: Draft
**Input**: User description: "Build an Obsidian Plugin which gathers Tasks from a Vault and syncs them to a remote CalDev calendar. It is possible that already synced Tasks can be updated in Obsidian or in the remote CalDev calendar. For now we only assume the possible changes are description changes, due date change or status change (open or completed)."

## Clarifications

### Session 2026-01-08

- Q: How should the system uniquely identify and track Obsidian tasks across file modifications to maintain sync mappings? → A: Embedded unique ID using Obsidian block reference syntax (e.g., `- [ ] Task description ^task-abc123`)
- Q: When a synced task is deleted in one system, what should happen during the next sync? → A: Ignore deletions (no deletion sync)
- Q: What specific due date format(s) should the system recognize and parse from Obsidian task lines? → A: Tasks plugin emoji format (`📅 YYYY-MM-DD`)
- Q: When network failures occur during sync, what should the system do from a user experience perspective? → A: Abort sync immediately, show error notification with failure reason, preserve all state from before sync started
- Q: Should the system support or prevent multiple Obsidian vaults syncing to the same CalDAV calendar? → A: Allow but document as unsupported use case
- Q: Should sync happen manually or automatically in the background? → A: Automatic background sync with configurable interval (default 60 seconds), show modal on error, automatic retry on next interval
- Q: How should users specify which Obsidian paths/folders to include or exclude from sync? → A: Folder path exclusion list (everything synced except specified folders)
- Q: Which tag/label format and filtering approach should be used? → A: Exclusion list using inline tags (sync all tasks except those with specified tags like #private or #local-only)
- Q: How should the system handle completed tasks based on their age? → A: Configurable age threshold (exclude completed tasks older than X days, default 30 days)
- Q: If multiple filters are configured, how should they be applied together? → A: ALL filters must pass (AND logic) - task syncs only if it passes all active filters

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initial Task Sync from Obsidian to CalDAV (Priority: P1)

A user has tasks written in their Obsidian vault using standard task markdown syntax and wants to sync them to their CalDAV calendar server so they can view and manage these tasks across multiple devices and applications that support CalDAV.

**Why this priority**: This is the foundation of the feature - without the ability to perform initial sync from Obsidian to CalDAV, no other functionality is possible. This delivers immediate value by making Obsidian tasks accessible outside the vault.

**Independent Test**: Can be fully tested by creating tasks in Obsidian, triggering a sync, and verifying the tasks appear in the CalDAV calendar with correct descriptions, due dates, and completion status. Delivers value by enabling cross-platform task visibility.

**Acceptance Scenarios**:

1. **Given** a user has configured CalDAV server credentials, **When** they create a task in Obsidian with a description and due date, **Then** the task is created on the CalDAV server with matching description and due date after the next automatic sync
2. **Given** a user has tasks in their vault, **When** automatic sync runs, **Then** all unsynchronized tasks are pushed to the CalDAV server
3. **Given** a user creates a completed task in Obsidian, **When** the automatic sync runs, **Then** the task appears on CalDAV server with completed status
4. **Given** a user creates a task without a due date, **When** the automatic sync runs, **Then** the task appears on CalDAV server without a due date

---

### User Story 2 - Update Synced Tasks from Obsidian to CalDAV (Priority: P2)

A user has previously synced tasks and modifies them in Obsidian (changing description, due date, or completion status). The changes should propagate to the CalDAV server to keep both sources in sync.

**Why this priority**: After initial sync works, users need to update tasks. This is the second most critical feature as it ensures Obsidian remains the source of truth for task modifications made in the vault.

**Independent Test**: Can be tested by syncing a task, modifying it in Obsidian (change description, due date, or status), waiting for the next automatic sync, and verifying the changes appear on the CalDAV server. Delivers value by ensuring task updates flow from Obsidian to external systems.

**Acceptance Scenarios**:

1. **Given** a task has been synced to CalDAV, **When** the user changes its description in Obsidian, **Then** the next automatic sync updates the description on the CalDAV server
2. **Given** a synced task with a due date, **When** the user changes the due date in Obsidian, **Then** the next automatic sync updates the due date on CalDAV server
3. **Given** a synced open task, **When** the user marks it as completed in Obsidian, **Then** the next automatic sync marks it as completed on CalDAV server
4. **Given** a synced completed task, **When** the user marks it as open in Obsidian, **Then** the next automatic sync marks it as open on CalDAV server

---

### User Story 3 - Update Synced Tasks from CalDAV to Obsidian (Priority: P3)

A user modifies a synced task on their CalDAV server (via mobile app, web interface, or another calendar client). These changes should be pulled back into Obsidian during the next sync to maintain bidirectional synchronization.

**Why this priority**: Enables true bidirectional sync. While less critical than Obsidian-to-CalDAV sync (as users primarily work in Obsidian), this allows users to update tasks on the go and have changes reflected in their vault.

**Independent Test**: Can be tested by syncing a task, modifying it on the CalDAV server (using any CalDAV client), waiting for the next automatic sync in Obsidian, and verifying the changes appear in the vault. Delivers value by enabling task updates from any CalDAV-compatible device.

**Acceptance Scenarios**:

1. **Given** a task has been synced to CalDAV, **When** the user changes its description on the CalDAV server and automatic sync runs, **Then** the description is updated in the Obsidian task
2. **Given** a synced task with a due date, **When** the user changes the due date on CalDAV server and automatic sync runs, **Then** the due date is updated in Obsidian
3. **Given** a synced open task, **When** the user marks it as completed on CalDAV server and automatic sync runs, **Then** it is marked as completed in Obsidian
4. **Given** a synced completed task, **When** the user marks it as open on CalDAV server and automatic sync runs, **Then** it is marked as open in Obsidian

---

### User Story 4 - Configure CalDAV Connection (Priority: P1)

A user needs to provide their CalDAV server connection details (server URL, username, password/token) to enable synchronization between Obsidian and the remote calendar.

**Why this priority**: This is a prerequisite for all sync functionality. Without configuration, no sync operations can occur. Tied with initial sync as P1 because both are essential for MVP.

**Independent Test**: Can be tested by opening plugin settings, entering CalDAV credentials, saving them, and verifying connection to the server succeeds. Delivers value by establishing the connection needed for all sync operations.

**Acceptance Scenarios**:

1. **Given** the plugin is installed, **When** the user opens settings and enters valid CalDAV credentials, **Then** the connection is validated and saved
2. **Given** the user enters invalid credentials, **When** they attempt to save settings, **Then** an error message is displayed indicating authentication failure
3. **Given** the user enters an unreachable server URL, **When** they attempt to save settings, **Then** an error message indicates the server cannot be reached
4. **Given** valid credentials are saved, **When** the user reopens the settings, **Then** the saved credentials are displayed (with password masked)

---

### User Story 5 - Configure Automatic Sync Interval (Priority: P1)

A user wants to control how frequently automatic synchronization occurs between Obsidian and CalDAV, with the ability to set a sync interval that balances responsiveness with system resource usage.

**Why this priority**: Automatic sync is core functionality, and users need control over sync frequency to balance their preferences for near-real-time updates versus battery/network usage. This is essential for MVP user experience.

**Independent Test**: Can be tested by opening plugin settings, changing the sync interval value (e.g., from 60 to 120 seconds), saving the setting, and verifying that syncs occur at the new interval. Delivers value by giving users control over sync behavior.

**Acceptance Scenarios**:

1. **Given** the plugin is installed, **When** the user opens settings, **Then** they see a sync interval configuration field with default value of 60 seconds
2. **Given** the user sets sync interval to 120 seconds, **When** they save settings, **Then** automatic syncs occur every 120 seconds
3. **Given** automatic sync is enabled, **When** a sync error occurs, **Then** a modal notification is displayed with the error message
4. **Given** a sync error has occurred, **When** the next sync interval elapses, **Then** the system automatically retries the sync operation
5. **Given** automatic sync is running, **When** the user manually triggers a sync, **Then** the manual sync executes immediately and resets the automatic sync timer

---

### User Story 6 - Configure Sync Filters (Priority: P2)

A user wants to control which tasks from their Obsidian vault are synced to CalDAV by excluding specific folders, tags, and old completed tasks to avoid syncing private, archived, or irrelevant tasks.

**Why this priority**: While not essential for basic sync functionality, filtering is important for users who want to maintain privacy, reduce sync volume, and keep their CalDAV calendar focused on relevant tasks. This is a key usability feature for production use.

**Independent Test**: Can be tested by configuring filters (excluded folders, excluded tags, completed task age threshold), creating tasks that match and don't match the filters, and verifying only appropriate tasks are synced. Delivers value by giving users granular control over what gets synced.

**Acceptance Scenarios**:

1. **Given** the user adds `Archive/` to excluded folders, **When** automatic sync runs, **Then** tasks in Archive folder and its subfolders are not synced to CalDAV
2. **Given** the user adds `#private` to excluded tags, **When** automatic sync runs, **Then** tasks with `#private` tag are not synced to CalDAV
3. **Given** the user sets completed task age threshold to 30 days, **When** automatic sync runs, **Then** completed tasks older than 30 days are not synced to CalDAV
4. **Given** multiple filters are configured, **When** automatic sync runs, **Then** a task is synced only if it passes all filters (not in excluded folder AND does not have excluded tags AND if completed, within age threshold)
5. **Given** a previously synced task now matches an exclusion filter, **When** automatic sync runs, **Then** the task remains on CalDAV (filters only apply to new syncs, not removal)
6. **Given** the user clears all filters, **When** automatic sync runs, **Then** all tasks in the vault are synced

---

### Edge Cases

- What happens when the same task is modified in both Obsidian and CalDAV between syncs? The system uses a last-write-wins strategy based on modification timestamps. The most recently modified version (whether from Obsidian or CalDAV) will overwrite the other during sync.
- What happens when a task is deleted in Obsidian but exists on CalDAV server? The task remains on the CalDAV server unchanged. Deletion is not synchronized.
- What happens when a task is deleted on CalDAV server but exists in Obsidian? The task remains in Obsidian unchanged. Deletion is not synchronized.
- What happens when the CalDAV server is unreachable during an automatic sync attempt? The sync aborts immediately, a modal notification is shown with the failure reason, all state from before the sync attempt is preserved, and the system will automatically retry at the next sync interval.
- What happens when a task in Obsidian has an invalid format or missing required fields? The task is skipped during sync with a warning notification indicating which tasks could not be synced and why.
- What happens when network connection is lost mid-sync? The sync aborts immediately, a modal notification is shown, all state from before the sync attempt is preserved (no partial sync), and the system will automatically retry at the next sync interval.
- What happens when multiple Obsidian vaults sync to the same CalDAV calendar? This is not prevented technically but is documented as an unsupported use case. Behavior is undefined and may result in unexpected task duplication or conflicts.
- What happens when a task description contains special characters that may not be CalDAV-compatible? Special characters are preserved as-is during sync. If the CalDAV server rejects them, the task sync fails with an error notification.
- What happens when a previously synced task is moved to an excluded folder? The task remains on CalDAV server. Filters only prevent initial sync, not removal of already synced tasks.
- What happens when a user adds an excluded tag to a previously synced task? The task remains on CalDAV server. Filters do not trigger removal of already synced tasks.
- What happens when a completed task ages beyond the threshold after being synced? The task remains on CalDAV server. The age filter only applies at sync time, not retroactively.
- What happens when a task matches multiple exclusion criteria (excluded folder AND excluded tag)? The task is excluded from sync (filters use AND logic, so any exclusion prevents sync).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST scan the Obsidian vault for tasks using markdown task syntax (e.g., `- [ ] task description`)
- **FR-002**: System MUST extract task description, due date (if present using `📅 YYYY-MM-DD` format), and completion status from Obsidian task syntax
- **FR-003**: System MUST establish connection to a CalDAV server using user-provided credentials
- **FR-004**: System MUST create new tasks on the CalDAV server for tasks not previously synced
- **FR-005**: System MUST maintain a mapping between Obsidian tasks and CalDAV tasks to track sync relationships
- **FR-005a**: System MUST generate and embed a stable unique identifier using Obsidian block reference syntax (e.g., `^task-abc123`) for each task that is synced to CalDAV
- **FR-005b**: System MUST use the embedded block reference ID to identify and track tasks across file renames, line insertions/deletions, and content moves
- **FR-006**: System MUST detect when a previously synced task has been modified in Obsidian (description, due date, or status change)
- **FR-007**: System MUST update the corresponding CalDAV task when changes are detected in Obsidian
- **FR-008**: System MUST retrieve tasks from the CalDAV server during sync operations
- **FR-009**: System MUST detect when a previously synced task has been modified on the CalDAV server
- **FR-010**: System MUST update the corresponding Obsidian task when changes are detected on CalDAV server
- **FR-011**: System MUST support bidirectional synchronization of task descriptions
- **FR-012**: System MUST support bidirectional synchronization of task due dates
- **FR-013**: System MUST support bidirectional synchronization of task completion status (open/completed)
- **FR-014**: Users MUST be able to configure CalDAV server URL, username, and password/authentication token
- **FR-015**: System MUST validate CalDAV connection credentials when settings are saved
- **FR-016**: Users MUST be able to trigger sync operations manually (via command or button)
- **FR-016a**: System MUST perform automatic background sync operations at a configurable interval (default 60 seconds)
- **FR-016b**: Users MUST be able to configure the automatic sync interval in plugin settings
- **FR-016c**: System MUST reset the automatic sync timer when a manual sync is triggered
- **FR-017**: System MUST provide feedback when sync operations start, complete, or fail
- **FR-017a**: System MUST display a modal notification when automatic sync encounters an error
- **FR-018**: System MUST persist sync state and task mappings between Obsidian sessions
- **FR-019**: System MUST handle authentication errors gracefully with clear error messages
- **FR-020**: System MUST handle network failures by aborting sync immediately, displaying a modal notification with failure reason, preserving all state from before sync started (no partial sync allowed), and automatically retrying at the next sync interval
- **FR-021**: System MUST resolve conflicts using last-write-wins strategy based on modification timestamps when a task is modified in both Obsidian and CalDAV between syncs
- **FR-022**: System MUST NOT synchronize task deletions - tasks deleted in one system remain unchanged in the other system
- **FR-023**: System MUST skip tasks with invalid format or missing required fields during sync and display warning notifications indicating which tasks could not be synced and why
- **FR-024**: Users MUST be able to configure a list of excluded folder paths in plugin settings
- **FR-025**: System MUST exclude tasks located in excluded folders or their subfolders from sync operations
- **FR-026**: Users MUST be able to configure a list of excluded tags in plugin settings (using inline `#tag` format)
- **FR-027**: System MUST exclude tasks containing any excluded tag from sync operations
- **FR-028**: Users MUST be able to configure a completed task age threshold in days (default 30 days)
- **FR-029**: System MUST exclude completed tasks older than the configured age threshold from sync operations
- **FR-030**: System MUST apply all configured filters using AND logic (task syncs only if it passes all active filters: not in excluded folder AND no excluded tags AND if completed, within age threshold)
- **FR-031**: System MUST NOT remove previously synced tasks from CalDAV when they subsequently match exclusion filters (filters only prevent initial sync)

### Key Entities

- **Task**: Represents a to-do item with properties including:
  - Description: The text content of the task
  - Due Date: Optional date when the task should be completed
  - Status: Either open (incomplete) or completed
  - Sync ID: Identifier linking the Obsidian task to its CalDAV counterpart

- **Sync Mapping**: Represents the relationship between an Obsidian task and a CalDAV task, including:
  - Obsidian task block reference ID (stable unique identifier embedded in task line using `^task-id` syntax)
  - CalDAV task UID (unique identifier on the CalDAV server)
  - Last sync timestamp
  - Last known state (for change detection)

- **CalDAV Configuration**: User-provided settings for connecting to the CalDAV server, including:
  - Server URL
  - Username
  - Password/authentication token
  - Selected calendar name or ID
  - Automatic sync interval (in seconds, default: 60)
  - Excluded folder paths (list of folder paths to exclude from sync)
  - Excluded tags (list of inline tags like `#private`, `#local-only` to exclude from sync)
  - Completed task age threshold (in days, default: 30, tasks completed older than this are excluded)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure CalDAV connection and verify successful connection within 2 minutes
- **SC-002**: Initial sync of 100 tasks from Obsidian to CalDAV completes within 30 seconds
- **SC-003**: Task modifications (description, due date, or status) made in Obsidian are reflected on CalDAV server after next automatic sync with 100% accuracy
- **SC-004**: Task modifications made on CalDAV server are reflected in Obsidian after next automatic sync with 100% accuracy
- **SC-005**: Sync operations handle network failures gracefully without losing data or corrupting sync state in 100% of cases, with automatic retry at next interval
- **SC-006**: Users can successfully complete a bidirectional sync workflow on first attempt 90% of the time
- **SC-007**: Task description, due date, and status changes are preserved exactly during sync with zero data loss
- **SC-008**: Automatic sync occurs at the configured interval (±5 seconds tolerance) with 95% reliability
- **SC-009**: Users receive modal error notifications within 2 seconds of sync failure during automatic sync
- **SC-010**: Sync filters (folder exclusions, tag exclusions, completed task age) are applied with 100% accuracy - no tasks matching exclusion criteria are synced

## Dependencies & Assumptions

### Dependencies

- Obsidian plugin API for accessing vault files and task data
- CalDAV protocol standard (RFC 4791) for calendar server communication
- Network connectivity between Obsidian and CalDAV server

### Assumptions

- Tasks in Obsidian follow standard markdown task syntax (e.g., `- [ ] task description`)
- Due dates in Obsidian use the Tasks plugin emoji format: `📅 YYYY-MM-DD` (e.g., `📅 2026-01-15`)
- CalDAV server supports VTODO items (task/to-do format)
- Users have valid credentials and permissions to read/write tasks on the CalDAV server
- The CalDAV calendar used for sync is dedicated to Obsidian tasks or the user accepts mixing with other tasks
- Task descriptions are plain text (no rich formatting in CalDAV)
- Sync operations occur automatically in the background at a configurable interval (default 60 seconds)
- Manual sync is also available and resets the automatic sync timer
- Tasks will be identified using Obsidian's block reference syntax, with stable unique IDs embedded at the end of each task line (e.g., `- [ ] Task description ^task-abc123`)
- Users accept that synced tasks will have block reference IDs appended to maintain sync tracking
- Each CalDAV calendar is intended for use with a single Obsidian vault - multiple vaults syncing to the same calendar is an unsupported configuration that may cause undefined behavior
- Sync filters (excluded folders, excluded tags, completed task age threshold) only prevent initial sync of tasks, not removal of already synced tasks
- Folder path exclusions apply recursively to all subfolders within the specified path
- Tag exclusions use inline `#tag` format (not frontmatter or other tag formats)
- Completed task age is calculated from the task's completion date to current date at sync time
- When multiple filters are configured, all must pass (AND logic) for a task to be synced

## Out of Scope

The following are explicitly NOT included in this feature:

- Synchronization of task priorities or tags beyond the three supported fields (description, due date, status)
- Conflict resolution UI for simultaneous edits (must be clarified in edge cases)
- Deletion synchronization (tasks deleted in one system)
- Synchronization of subtasks or task hierarchies
- Rich text formatting in task descriptions
- Task recurrence patterns
- Task attachments or file links
- Multi-calendar support (syncing to multiple CalDAV calendars)
- Offline mode with queued sync operations
- Real-time synchronization (push notifications from CalDAV server)
- Advanced filtering: glob patterns, regex matching, custom filter expressions
- Inclusion-based filtering (whitelist approach - only sync specific folders/tags)
- Automatic removal of previously synced tasks when they match new exclusion filters
- Frontmatter tag filtering (only inline `#tag` format supported)

## Scope Boundaries

### Included
- Automatic background sync at configurable intervals (default 60 seconds)
- Manual sync triggered by user action (resets automatic sync timer)
- Three task properties: description, due date, completion status
- Modal error notifications with automatic retry on failure
- Single CalDAV calendar connection
- Bidirectional sync between Obsidian and CalDAV
- Sync filters: excluded folder paths, excluded tags, completed task age threshold
- AND logic for combining multiple filters

### Excluded
- All items listed in "Out of Scope" section above
- Advanced conflict resolution strategies
- Performance optimization for very large task sets (>1000 tasks)
- Migration tools from other task management systems

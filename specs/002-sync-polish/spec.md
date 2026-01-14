# Feature Specification: Sync Polish - Notifications, Logging & Data Preservation

**Feature Branch**: `002-sync-polish`
**Created**: 2026-01-14
**Status**: Draft
**Input**: User description: "Address the points under OPEN_POINTS.md: 1) Send modal notifications only if there is an error. 2) Log only when a sync has started and is finished. Other (Debug) logs should only be shown if a debug setting is activated on the settings tab. 3) If changes have been made to the Task on the CalDAV server, e.g. a Category has been assigned which is not relevant for Obsidian, this should be kept in the future, meaning if afterwards a local change is done in Obsidian, this should not affect the additional information."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Error-Only Modal Notifications (Priority: P1)

A user has automatic sync running in the background. They want to be notified when something goes wrong, but not interrupted by modal dialogs for successful syncs. Currently, the system may display modal notifications for sync errors, but the user wants to ensure that only errors (not successes or informational messages) trigger modal interruptions.

**Why this priority**: User experience is critically impacted by unnecessary interruptions. Modal dialogs require user interaction to dismiss, which disrupts workflow. Reserving modals for errors ensures users are only interrupted when action is needed.

**Independent Test**: Can be fully tested by configuring automatic sync, triggering both successful syncs and sync errors, and verifying that modal dialogs only appear for errors while successful syncs show non-intrusive notifications (or no notification at all).

**Acceptance Scenarios**:

1. **Given** automatic sync is enabled, **When** a sync completes successfully, **Then** no modal dialog is displayed
2. **Given** automatic sync is enabled, **When** a sync fails due to network error, **Then** a modal dialog is displayed with the error details
3. **Given** automatic sync is enabled, **When** a sync fails due to authentication error, **Then** a modal dialog is displayed with the error details
4. **Given** manual sync is triggered, **When** the sync fails, **Then** an error notification is shown (modal or non-modal based on user preference)

---

### User Story 2 - Configurable Debug Logging (Priority: P1)

A user wants to see only essential sync information (sync started, sync finished) in the console by default, but have the option to enable verbose debug logging when troubleshooting issues. Debug logs should only appear when explicitly enabled via a setting.

**Why this priority**: Console clutter makes troubleshooting difficult and degrades performance perception. Users need control over logging verbosity. This directly impacts supportability and user experience during troubleshooting.

**Independent Test**: Can be fully tested by observing console output during sync with debug mode disabled (should only show start/finish), then enabling debug mode and verifying detailed logs appear.

**Acceptance Scenarios**:

1. **Given** debug logging is disabled (default), **When** a sync runs, **Then** only "Sync started" and "Sync finished" messages appear in the console
2. **Given** debug logging is enabled in settings, **When** a sync runs, **Then** detailed debug messages (task processing, conflict resolution, etc.) appear in the console
3. **Given** debug logging is disabled, **When** the user enables it in settings, **Then** subsequent syncs show debug output without requiring restart
4. **Given** debug logging is enabled, **When** the user disables it in settings, **Then** subsequent syncs only show essential logs without requiring restart
5. **Given** the plugin is installed for the first time, **When** the user opens settings, **Then** debug logging is disabled by default

---

### User Story 3 - Preserve CalDAV Extended Properties (Priority: P2)

A user manages their tasks on a CalDAV server where they (or other applications) add additional metadata such as categories, tags, priority levels, or custom properties that are not relevant to Obsidian. When the user modifies a task in Obsidian and syncs, the additional CalDAV properties should be preserved rather than stripped away.

**Why this priority**: Data preservation is critical for users who use multiple tools with their CalDAV server. Losing metadata would make Obsidian sync destructive rather than cooperative, potentially causing users to lose important categorization done elsewhere.

**Independent Test**: Can be fully tested by creating a task in Obsidian, syncing it to CalDAV, adding a category/property on the CalDAV server, modifying the task description in Obsidian, syncing again, and verifying the category is preserved on CalDAV.

**Acceptance Scenarios**:

1. **Given** a task synced to CalDAV has a category added via CalDAV client, **When** the task description is updated in Obsidian and synced, **Then** the category remains on the CalDAV task
2. **Given** a task synced to CalDAV has a priority set via CalDAV client, **When** the task due date is updated in Obsidian and synced, **Then** the priority remains on the CalDAV task
3. **Given** a task synced to CalDAV has custom properties added via CalDAV client, **When** the task status is changed in Obsidian and synced, **Then** the custom properties remain on the CalDAV task
4. **Given** a task synced to CalDAV has multiple extended properties, **When** Obsidian modifies any of the synced fields (description, due date, status), **Then** all extended properties are preserved
5. **Given** a new task is created in Obsidian without extended properties, **When** the task is synced to CalDAV for the first time, **Then** it is created without any extended properties (clean creation)

---

### Edge Cases

- What happens when a CalDAV property conflicts with an Obsidian field being updated? Only the specific synced fields (description, due date, status) are updated; all other CalDAV properties are preserved unchanged.
- What happens when the CalDAV server returns a task with malformed extended properties? Malformed properties are preserved as-is during sync; the system does not validate or modify properties it does not manage.
- What happens when debug logging is toggled mid-sync? The new setting takes effect for subsequent log statements within the current sync and all future syncs.
- What happens when a sync error occurs but the modal notification fails to display? The error is still logged to the console regardless of notification display status.
- What happens when the CalDAV server adds properties that use the same field names as Obsidian fields? Obsidian only manages SUMMARY (description), DUE (due date), and STATUS (completion status); all other properties including duplicates are preserved as-is.

## Requirements *(mandatory)*

### Functional Requirements

**Notification Behavior**

- **FR-001**: System MUST NOT display modal notifications for successful sync operations
- **FR-002**: System MUST display modal notification when automatic sync encounters an error
- **FR-003**: System MUST display error details in the modal notification including the error type and message
- **FR-004**: System MUST allow users to dismiss error modal notifications with a single action

**Logging Behavior**

- **FR-005**: System MUST provide a debug logging toggle setting in the plugin settings tab
- **FR-006**: System MUST default debug logging to disabled for new installations
- **FR-007**: System MUST log a "sync started" message at the INFO level when any sync operation begins
- **FR-008**: System MUST log a "sync finished" message at the INFO level when any sync operation completes (success or failure)
- **FR-009**: System MUST only output debug-level logs (task processing details, conflict resolution steps, etc.) when debug logging is enabled
- **FR-010**: System MUST apply debug logging setting changes immediately without requiring plugin reload
- **FR-011**: System MUST persist the debug logging setting between Obsidian sessions

**CalDAV Data Preservation**

- **FR-012**: System MUST fetch the existing CalDAV task data before updating a previously synced task
- **FR-013**: System MUST preserve all CalDAV properties that are not managed by the plugin when updating a task
- **FR-014**: System MUST only modify the SUMMARY, DUE, and STATUS properties during task updates from Obsidian
- **FR-015**: System MUST retain CalDAV CATEGORIES property when updating tasks from Obsidian
- **FR-016**: System MUST retain CalDAV PRIORITY property when updating tasks from Obsidian
- **FR-017**: System MUST retain any custom or extended CalDAV properties when updating tasks from Obsidian
- **FR-018**: System MUST NOT add placeholder or default values for properties that were not present on the original CalDAV task

### Key Entities

- **Debug Setting**: Boolean configuration that controls whether verbose logging is output to the console
  - Default value: false (disabled)
  - Persistence: Stored with plugin settings
  - Runtime behavior: Changes take effect immediately

- **CalDAV Extended Properties**: Properties on VTODO items that are not managed by the Obsidian plugin
  - CATEGORIES: Task categorization
  - PRIORITY: Task priority level (0-9)
  - DESCRIPTION: Extended task description (separate from SUMMARY)
  - Custom X- properties: Vendor-specific extensions
  - Any other standard iCalendar VTODO properties not explicitly managed

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users experience zero modal interruptions during successful automatic sync operations
- **SC-002**: Users can enable debug logging and see detailed output within 5 seconds of toggling the setting
- **SC-003**: 100% of CalDAV extended properties are preserved when tasks are updated from Obsidian
- **SC-004**: Console output during normal operation (debug disabled) is reduced to 2 log lines per sync (start and finish)
- **SC-005**: Users can troubleshoot sync issues by enabling debug mode and observing detailed processing steps
- **SC-006**: Tasks modified in Obsidian retain all CalDAV categories and custom properties after sync with 100% reliability
- **SC-007**: Default plugin installation produces minimal console output without user configuration

## Dependencies & Assumptions

### Dependencies

- Existing notification system in `src/ui/notifications.ts`
- Existing logger implementation in `src/sync/logger.ts`
- Existing CalDAV client and VTODO handling in `src/caldav/`
- Existing settings system in `src/settings.ts`

### Assumptions

- The CalDAV server supports retrieval of full VTODO data including all properties
- Extended properties follow iCalendar RFC 5545 format and can be parsed and preserved as strings
- The plugin settings tab has capacity for additional toggle settings
- Console logging is the primary debugging mechanism (no separate log file)
- Users prefer minimal notification interruptions during normal operation
- Properties not managed by the plugin should be treated as opaque data to preserve

## Out of Scope

The following are explicitly NOT included in this feature:

- Support for managing CalDAV categories from within Obsidian
- Displaying CalDAV extended properties in the Obsidian task view
- Synchronizing CalDAV priority to Obsidian task priority
- Log file output (beyond browser console)
- Notification preferences beyond error-only modals (e.g., notification sounds, desktop notifications)
- Per-property preservation settings (all extended properties are preserved uniformly)
- Migration or cleanup of existing tasks that may have lost extended properties

## Scope Boundaries

### Included

- Error-only modal notification behavior for automatic sync
- Debug logging toggle in settings with immediate effect
- Essential logging (sync start/finish) always enabled
- Preservation of CalDAV extended properties during Obsidian-initiated updates
- Read-before-update pattern for CalDAV task modifications

### Excluded

- All items listed in "Out of Scope" section above
- Changes to manual sync notification behavior (remains as-is)
- Any new CalDAV property synchronization beyond current scope (description, due date, status)

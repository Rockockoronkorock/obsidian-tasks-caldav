# Feature Specification: Obsidian Link Sync to CalDAV

**Feature Branch**: `003-obsidian-link-sync`
**Created**: 2026-01-23
**Status**: Draft
**Input**: User description: "I want that if my Tasks from Obsidian get synced to CalDev that on obsidian link should be also populated in the Notes section of the CalDev description. This enables the use to click the obsidian URI which opens the Obsidian application and directly opens the relevant note where the task is. This enables the user to open the context of the task in Obsidian."

## Clarifications

### Session 2026-01-23

- Q: When appending the Obsidian URI to the CalDAV DESCRIPTION field, what format should be used? → A: Labeled with newline separator: `\n\nObsidian Link: obsidian://open?vault=...` (for clarity)
- Q: What should happen if the CalDAV server has character limits on the DESCRIPTION field that would truncate the Obsidian URI? → A: Allow truncation - if the server truncates, the URI may be broken (assumes standard CalDAV servers have adequate limits)
- Q: What should happen when a task has a missing or malformed block ID during sync to CalDAV? → A: Skip URI generation - don't add an Obsidian URI to the DESCRIPTION field (block ID is essential for accurate linking)
- Q: When updating an existing CalDAV task that already has an Obsidian URI in its DESCRIPTION field, what should happen? → A: Never overwrite the description - the description with Obsidian URI should only be synced during initial sync
- Q: When a user copies/duplicates a task in Obsidian (same description text but different block IDs), what should happen during sync? → A: Treat as separate tasks - create independent CalDAV tasks with unique URIs for each block ID (honors Obsidian's task model)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick Task Context Access from CalDAV Client (Priority: P1)

A user is reviewing their tasks in a CalDAV-compatible calendar application (Apple Calendar, Google Calendar, Thunderbird, etc.) and sees a task that was originally created in Obsidian. They want to understand the full context of the task by viewing the note where it was created, without switching to Obsidian and manually searching for the note.

**Why this priority**: This is the core value proposition of the feature - enabling seamless context switching between CalDAV clients and Obsidian. Users often triage tasks on mobile or in calendar apps but need the full note context to work on them effectively.

**Independent Test**: Can be fully tested by creating a task in Obsidian, syncing to CalDAV, opening the task in any CalDAV client, and verifying the clickable Obsidian URI opens the correct note. This delivers immediate value even as a standalone feature.

**Acceptance Scenarios**:

1. **Given** a task exists in an Obsidian note with a block ID, **When** the task is synced to CalDAV for the first time, **Then** the CalDAV task description contains a properly formatted Obsidian URI pointing to the specific task block
2. **Given** a synced task's Obsidian URI in the CalDAV description, **When** the user clicks the link in their CalDAV client (e.g., Apple Calendar on macOS/iOS), **Then** Obsidian launches and navigates directly to the note and task location
3. **Given** multiple tasks from the same Obsidian note are synced, **When** viewing them in CalDAV, **Then** each task has a unique Obsidian URI pointing to its specific block location
4. **Given** a task has already been synced to CalDAV with an Obsidian URI, **When** the task is updated and re-synced, **Then** the DESCRIPTION field (including the URI) remains unchanged

---

### User Story 2 - Mobile Workflow Optimization (Priority: P2)

A user is on their mobile device reviewing tasks in their calendar app during commute or meetings. They encounter a task that requires more information before they can act on it. Instead of manually opening Obsidian and searching, they tap the Obsidian link in the task description.

**Why this priority**: Mobile workflows are a common use case for task management, and seamless app switching is critical for productivity. This builds on P1 by specifically addressing mobile user experience.

**Independent Test**: Can be tested independently on iOS/Android devices by syncing a task, viewing it in a mobile calendar app, and tapping the Obsidian URI to verify it launches Obsidian mobile and navigates to the correct note.

**Acceptance Scenarios**:

1. **Given** a synced task viewed on iOS in Apple Calendar or Reminders, **When** the user taps the Obsidian URI, **Then** Obsidian iOS app opens and displays the source note with the task highlighted
2. **Given** a synced task viewed on Android in Google Calendar or Tasks, **When** the user taps the Obsidian URI, **Then** Obsidian Android app opens and navigates to the source note

---

### Edge Cases

- How does the system handle tasks in notes with special characters or spaces in the file path?
- How does the system handle vaults with spaces or special characters in their names?
- Tasks that are copied/duplicated in Obsidian (same description but different block IDs) are treated as separate independent tasks, each receiving its own CalDAV entry with a unique URI
- If the Obsidian block ID is missing or malformed, the system will skip URI generation and sync the task without an Obsidian URI in the DESCRIPTION field
- If the CalDAV server truncates the DESCRIPTION field due to character limits, the URI may be broken (acceptable; assumes standard servers have adequate limits)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST append a valid Obsidian URI to the CalDAV task DESCRIPTION field only during the initial sync from Obsidian to CalDAV
- **FR-002**: The Obsidian URI MUST use the format `obsidian://open?vault=[VaultName]&file=[EncodedFilePath]&block=[BlockID]` with proper URL encoding
- **FR-003**: The Obsidian URI MUST include the vault name, file path relative to vault root, and task block ID
- **FR-004**: System MUST NOT update or overwrite the CalDAV DESCRIPTION field on subsequent syncs after initial task creation
- **FR-005**: System MUST preserve existing CalDAV task properties (summary, due date, status) when syncing task updates, excluding the DESCRIPTION field which remains untouched
- **FR-006**: System MUST handle file paths and vault names containing spaces, special characters, and Unicode characters by properly URL-encoding them
- **FR-007**: System MUST NOT sync the Obsidian URI back from CalDAV to Obsidian (one-way enrichment from Obsidian to CalDAV only)
- **FR-008**: System MUST skip Obsidian URI generation when a task's block ID is missing or malformed, syncing the task without URI enrichment
- **FR-009**: System MUST treat tasks with identical descriptions but different block IDs as separate independent tasks, creating unique CalDAV entries with distinct URIs for each
- **FR-010**: System MUST place the Obsidian URI in the CalDAV DESCRIPTION property, keeping the SUMMARY field for the task description text only
- **FR-011**: During initial sync, system MUST preserve any existing content in the CalDAV DESCRIPTION field and append the Obsidian URI using the format: `\n\nObsidian Link: [full URI]`

### Key Entities

- **Obsidian URI**: A clickable deep link containing vault name, file path, and block reference that opens Obsidian to a specific task location
- **CalDAV VTODO**: The iCalendar task object with SUMMARY (task text) and DESCRIPTION (extended notes/metadata including Obsidian URI) properties
- **Task Block ID**: The unique identifier (format: `task-[uuid]`) that anchors a task to a specific location in an Obsidian note

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can navigate from any CalDAV client to the source Obsidian note in under 2 clicks (view task → click URI)
- **SC-002**: Obsidian URIs successfully launch Obsidian and navigate to the correct note in 100% of cases when the note still exists at the original location
- **SC-003**: The feature works across all major CalDAV clients (Apple Calendar, Google Calendar, Thunderbird, Microsoft Outlook) with clickable URIs
- **SC-004**: Users report reduced context-switching time when working with tasks across Obsidian and CalDAV clients
- **SC-005**: DESCRIPTION field remains stable after initial sync, preserving user-added notes and the original URI

## Assumptions

- Users have Obsidian installed and the vault is accessible on the device where they click the URI
- CalDAV servers support the DESCRIPTION property in VTODO objects (industry standard, but not universally implemented in all clients' UI)
- CalDAV servers have adequate DESCRIPTION field character limits (typically 1000+ characters) to accommodate existing content plus Obsidian URIs (typically 100-200 characters)
- The operating system supports the `obsidian://` URI scheme (requires Obsidian to be installed and registered as a URI handler)
- Users primarily use CalDAV clients that render DESCRIPTION fields as clickable links (most modern calendar apps do)
- Vault names and file paths remain stable after initial sync (URIs point to original locations and are not updated if files are moved)
- Block IDs remain stable once assigned (already enforced by current implementation)
- Users understand that moving or renaming notes after initial sync will result in stale URIs in CalDAV

## Out of Scope

- Adding Obsidian URIs to the SUMMARY field (kept for task description text only)
- Supporting custom URI formats or non-standard Obsidian URI schemes
- Syncing Obsidian URIs from CalDAV back to Obsidian notes (unidirectional enrichment)
- Updating Obsidian URIs in CalDAV after initial sync (URIs are set once during task creation and never updated)
- Handling stale URIs when notes are moved or vaults renamed after initial sync (user responsibility to manage file organization)
- Handling cases where Obsidian is not installed (OS will show error; user responsibility)
- Validating that the note still exists before generating the URI (sync assumes current state)
- Adding visual indicators in Obsidian UI showing that a task has been synced to CalDAV
- Syncing tasks from CalDAV to Obsidian (this feature only enriches Obsidian→CalDAV sync direction)

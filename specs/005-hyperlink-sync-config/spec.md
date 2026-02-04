# Feature Specification: Hyperlink Sync Behavior Configuration

**Feature Branch**: `005-hyperlink-sync-config`
**Created**: 2026-02-04
**Status**: Draft
**Input**: User description: "I want a small change to the current Obsidian Plugin Sync Logic. I want to configure whether Hyperlinks (in the Markdown format) in the task description should stay as is, put into the Notes section or should be ignored."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keep Hyperlinks Visible in Task Summary (Priority: P1)

A user has tasks in Obsidian that contain markdown hyperlinks in the description, such as `[project brief](https://example.com/brief)`. They want those hyperlinks to remain exactly as written in the task summary when synced to their CalDAV calendar app, so that the link text and URL are visible right alongside the task description.

**Why this priority**: This is the simplest and most conservative option — it preserves the current default behavior and requires no transformation. It is the natural starting point and the mode users are most likely to expect if they have not thought about the distinction.

**Independent Test**: Can be fully tested by creating a task in Obsidian containing a markdown hyperlink, configuring the setting to "Keep as-is", syncing to CalDAV, and verifying the task summary in the CalDAV client contains the raw markdown hyperlink text unchanged.

**Acceptance Scenarios**:

1. **Given** the hyperlink sync setting is configured to "Keep as-is", **When** a task with a markdown hyperlink in its description is synced to CalDAV, **Then** the CalDAV task summary contains the hyperlink exactly as it appears in Obsidian (raw markdown syntax preserved)
2. **Given** the hyperlink sync setting is "Keep as-is" and a task contains multiple hyperlinks, **When** the task is synced, **Then** all hyperlinks remain in the summary untouched

---

### User Story 2 - Move Hyperlinks to Notes Section (Priority: P2)

A user wants a cleaner task summary in their CalDAV client but does not want to lose the hyperlinks entirely. They configure the plugin to extract all markdown hyperlinks from the task description and place them into the Notes (DESCRIPTION) section of the CalDAV task. The task summary shows only the plain text, while the links are preserved in a dedicated section below.

**Why this priority**: This is the most useful mode for users who work heavily in CalDAV clients with limited summary display. It keeps the task title clean and readable while preserving all hyperlink information for later reference. It builds on the existing DESCRIPTION field usage (Obsidian Link from feature 003) and must coexist with it.

**Independent Test**: Can be fully tested by creating a task with one or more hyperlinks, configuring the setting to "Move to Notes", syncing, and verifying the CalDAV summary contains only plain text while the Notes section contains the extracted hyperlinks in a readable format.

**Acceptance Scenarios**:

1. **Given** the hyperlink sync setting is "Move to Notes", **When** a task with markdown hyperlinks is synced to CalDAV, **Then** the CalDAV task summary contains only the link display text (e.g., "project brief") with the URL removed, and the Notes section contains the full hyperlinks listed in a readable format
2. **Given** the hyperlink sync setting is "Move to Notes" and the task already has an Obsidian Link in the Notes section (from feature 003), **When** the task is synced, **Then** the extracted hyperlinks appear in the Notes section above the existing Obsidian Link, and the Obsidian Link is not disturbed
3. **Given** the hyperlink sync setting is "Move to Notes" and a task contains no hyperlinks, **When** the task is synced, **Then** the Notes section is unaffected and no hyperlink section is added

---

### User Story 3 - Strip Hyperlinks Entirely (Priority: P3)

A user wants the cleanest possible task summary in their CalDAV client and does not need the hyperlink URLs at all. They configure the plugin to remove all markdown hyperlink URLs from the task description, leaving only the display text in the summary and discarding the URLs.

**Why this priority**: Some CalDAV clients display raw URLs awkwardly, and some users simply prefer minimal, distraction-free task titles. This mode sacrifices the URLs for maximum readability. It is the most destructive option and therefore lowest priority — users should understand that the URLs are not preserved anywhere.

**Independent Test**: Can be fully tested by creating a task with hyperlinks, configuring the setting to "Strip hyperlinks", syncing, and verifying the CalDAV summary contains only the display text with no URLs present anywhere in the task.

**Acceptance Scenarios**:

1. **Given** the hyperlink sync setting is "Strip hyperlinks", **When** a task with markdown hyperlinks is synced to CalDAV, **Then** the CalDAV task summary contains only the display text of each hyperlink (e.g., "project brief") and the URLs are removed entirely
2. **Given** the hyperlink sync setting is "Strip hyperlinks" and a task contains only a bare URL with no display text (e.g., `[https://example.com](https://example.com)`), **When** the task is synced, **Then** the bare URL is retained as the display text since removing it would leave an empty reference

---

### Edge Cases

- A task description contains a hyperlink with no display text (empty brackets: `[](https://example.com)`) — in "Move to Notes" and "Strip" modes, the empty display text should not leave awkward whitespace or punctuation in the summary
- A task description contains nested or malformed markdown link syntax — the system should only process well-formed markdown hyperlinks (`[text](url)`) and leave any malformed syntax untouched
- A task description contains only hyperlinks and no other text — in "Move to Notes" and "Strip" modes, the resulting summary should not be empty; if stripping would produce an empty summary, the original description is kept unchanged
- A task description contains hyperlinks with special characters or very long URLs — these should be handled the same as standard hyperlinks regardless of length or content
- The user changes the hyperlink sync setting between syncs — the new setting applies to the next sync; previously synced tasks are not retroactively modified

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to select one of three hyperlink sync modes in the plugin settings: "Keep as-is", "Move to Notes", or "Strip hyperlinks"
- **FR-002**: The selected hyperlink sync mode MUST persist across plugin restarts and vault sessions
- **FR-003**: In "Keep as-is" mode, the system MUST sync the task description to CalDAV with all markdown hyperlinks preserved exactly as written
- **FR-004**: In "Move to Notes" mode, the system MUST extract all well-formed markdown hyperlinks from the task description, place the display text only in the CalDAV task summary, and list the extracted hyperlinks in the CalDAV Notes (DESCRIPTION) section
- **FR-005**: In "Move to Notes" mode, extracted hyperlinks MUST be placed in the Notes section above any existing Obsidian Link content (from feature 003), preserving the Obsidian Link position and content
- **FR-006**: In "Strip hyperlinks" mode, the system MUST replace each well-formed markdown hyperlink in the task description with its display text only, discarding the URL entirely from both summary and Notes
- **FR-007**: The system MUST only process well-formed markdown hyperlinks (syntax: `[display text](url)`) and MUST leave any malformed or non-standard link syntax untouched regardless of the selected mode
- **FR-008**: The system MUST NOT produce an empty task summary as a result of hyperlink processing; if processing would result in an empty summary, the original unmodified description MUST be used instead
- **FR-009**: The hyperlink sync setting MUST apply only at sync time — changing the setting does not retroactively modify previously synced CalDAV tasks
- **FR-010**: The default value for the hyperlink sync setting MUST be "Keep as-is" to preserve backward compatibility with existing sync behavior

### Key Entities

- **Hyperlink Sync Mode**: A user-configurable setting with three possible values ("Keep as-is", "Move to Notes", "Strip hyperlinks") that controls how markdown hyperlinks in task descriptions are handled during sync
- **Markdown Hyperlink**: A well-formed inline link in the format `[display text](url)` within a task description
- **CalDAV Task Summary**: The primary task text field (SUMMARY property) visible in most CalDAV client views
- **CalDAV Notes**: The extended description field (DESCRIPTION property) used for supplementary task information, already shared with the Obsidian Link from feature 003

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of well-formed markdown hyperlinks in task descriptions are correctly processed according to the selected sync mode on every sync
- **SC-002**: Users can change the hyperlink sync mode and see the effect reflected on the next synced task without restarting the plugin or re-authenticating
- **SC-003**: The "Move to Notes" mode produces task summaries that are shorter and cleaner than the raw markdown (measured as: summary length with links moved is less than summary length with raw markdown hyperlinks retained)
- **SC-004**: Existing Obsidian Link content in the Notes section (from feature 003) remains intact and unmodified regardless of which hyperlink sync mode is active
- **SC-005**: Zero task summaries are left empty as a result of hyperlink processing across all modes

## Assumptions

- "Hyperlinks in the Markdown format" refers specifically to standard inline markdown links (`[text](url)`) and does not include Obsidian wikilinks (`[[note name]]`), autolinked bare URLs, or other link syntaxes
- The DESCRIPTION field in CalDAV is shared with the Obsidian Link feature (003); the hyperlink sync feature must coexist with that content without conflict
- The hyperlink sync setting is global — it applies uniformly to all tasks, not per-task or per-folder
- CalDAV clients vary in how they render the DESCRIPTION field; the extracted hyperlinks in "Move to Notes" mode are formatted as plain text list items rather than relying on any specific rendering capability
- Tasks synced from CalDAV back to Obsidian are not affected by this setting — hyperlink processing only applies in the Obsidian → CalDAV sync direction
- The user's CalDAV client supports displaying the DESCRIPTION/Notes field (most modern clients do)

## Out of Scope

- Processing Obsidian wikilinks (`[[note]]` syntax) — only standard markdown hyperlinks are in scope
- Retroactive modification of previously synced CalDAV tasks when the setting is changed
- Per-task or per-folder hyperlink sync mode configuration (setting is global)
- Rendering extracted hyperlinks as clickable links in the CalDAV Notes section (plain text format only; clickability depends on the CalDAV client)
- Syncing hyperlink processing behavior from CalDAV back to Obsidian
- Handling or processing autolinked bare URLs (e.g., `https://example.com` without markdown syntax)

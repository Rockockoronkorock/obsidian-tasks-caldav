# Data Model: Obsidian Link Sync to CalDAV

**Feature**: 003-obsidian-link-sync | **Date**: 2026-01-23

## Overview

This document defines the data entities, transformations, and state models for the Obsidian Link Sync feature. The feature introduces minimal new data structures, primarily extending existing models with optional fields and transformation logic.

---

## Core Entities

### 1. Obsidian URI

**Description**: A deep link to a specific task location in an Obsidian vault.

**Structure**:
```typescript
// Not a stored entity - computed on demand
interface ObsidianURIComponents {
  vaultName: string;    // From Obsidian API: vault.getName()
  filePath: string;     // Vault-relative path (e.g., "Projects/tasks.md")
  blockId: string;      // Format: "task-{uuid}" (e.g., "task-a1b2c3d4-...")
}
```

**Derived String Format**:
```
obsidian://open?vault={encodedVaultName}&file={encodedFilePath}&block={blockId}
```

**Source Data**:
- `vaultName`: Retrieved once per sync via `this.vault.getName()` (Obsidian Vault API)
- `filePath`: From existing Task object property `task.filePath` (string)
- `blockId`: From existing Task object property `task.blockId` (string)

**Validation Rules**:
- All components must be non-empty strings
- `blockId` must match regex: `/^task-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/`
- `vaultName` and `filePath` require URL encoding via `encodeURIComponent()`
- `blockId` does not require encoding (UUID-safe characters only)

**Lifecycle**:
- **Created**: During initial task sync from Obsidian to CalDAV
- **Updated**: Never (URIs are immutable after creation)
- **Deleted**: When CalDAV task is deleted (no orphan cleanup needed)

**Example**:
```typescript
// Input components
vaultName: "My Work Vault"
filePath: "Projects/Q1 Planning/tasks.md"
blockId: "task-a1b2c3d4-e5f6-7890-abcd-ef1234567890"

// Output URI
obsidian://open?vault=My%20Work%20Vault&file=Projects%2FQ1%20Planning%2Ftasks.md&block=task-a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

### 2. Enhanced VTODO with DESCRIPTION

**Description**: Extended iCalendar VTODO object that includes an Obsidian URI in the DESCRIPTION field.

**Current VTODO Structure** (from existing implementation):
```
BEGIN:VTODO
UID:{uuid}
DTSTAMP:{timestamp}
SUMMARY:{escaped-task-description}
STATUS:{NEEDS-ACTION|COMPLETED}
DUE;VALUE=DATE:{YYYYMMDD}        (optional)
LAST-MODIFIED:{timestamp}
END:VTODO
```

**Enhanced VTODO Structure** (with Obsidian URI):
```
BEGIN:VTODO
UID:{uuid}
DTSTAMP:{timestamp}
SUMMARY:{escaped-task-description}
DESCRIPTION:\n\nObsidian Link: {obsidian-uri}    ← NEW FIELD
STATUS:{NEEDS-ACTION|COMPLETED}
DUE;VALUE=DATE:{YYYYMMDD}        (optional)
LAST-MODIFIED:{timestamp}
END:VTODO
```

**DESCRIPTION Field Format**:
```
{existing-content}\n\nObsidian Link: {obsidian-uri}
```
- Prefix: `\n\n` (two newlines for visual separation)
- Label: `Obsidian Link:` (human-readable identifier)
- URI: Full `obsidian://` URI (URL-encoded)
- Escaping: RFC 5545 TEXT value escaping applied to entire field

**State Transitions**:
```
[Task Created in Obsidian]
         ↓
[Initial Sync to CalDAV]
         ↓
[VTODO Created with DESCRIPTION containing URI]
         ↓
[Task Updated in Obsidian] → [VTODO Updated: SUMMARY/STATUS/DUE only]
         ↓                                    ↓
[DESCRIPTION Field Preserved] ← [Property Preservation Pattern]
```

**Property Lifecycle**:
- **DESCRIPTION set**: During `createTask()` only
- **DESCRIPTION preserved**: During `updateTask()` via property preservation
- **DESCRIPTION read**: Never (plugin doesn't read DESCRIPTION from CalDAV)

**Validation Rules**:
- DESCRIPTION is optional (present only if block ID is valid)
- If present, must contain the string `Obsidian Link:` followed by a valid URI
- TEXT escaping must be applied per RFC 5545 (backslash, semicolon, comma, newline)
- Maximum length: Assumed unlimited (CalDAV servers typically support 1000+ chars)

---

### 3. Task Object Extension (Conceptual)

**Description**: No modifications to the Task interface are needed. Existing properties are sufficient.

**Existing Task Properties Used**:
```typescript
interface Task {
  description: string;     // Task text (synced to SUMMARY)
  blockId: string;         // UUID identifier (used in Obsidian URI)
  filePath: string;        // Vault-relative path (used in Obsidian URI)
  dueDate?: string;        // Due date (synced to DUE)
  status: TaskStatus;      // Open/completed (synced to STATUS)
  // ... other properties not relevant to this feature
}
```

**No new fields required** ✓

**Access Pattern**:
```typescript
// During sync:
const task: Task = ...; // From vault scanner
const vaultName = this.vault.getName();

// All data needed for URI generation is available:
buildObsidianURI(vaultName, task.filePath, task.blockId);
```

---

## Data Transformations

### 1. URI Construction

**Input**:
- `vaultName: string` (from Vault API)
- `filePath: string` (from Task object)
- `blockId: string` (from Task object)

**Output**:
- `uri: string` (fully formatted Obsidian URI)

**Transformation**:
```typescript
function buildObsidianURI(vaultName: string, filePath: string, blockId: string): string {
  // Validate inputs
  if (!blockId || !isValidBlockId(blockId)) {
    throw new Error("Invalid or missing block ID");
  }
  if (!vaultName || !filePath) {
    throw new Error("Vault name and file path are required");
  }

  // URL-encode components
  const encodedVault = encodeURIComponent(vaultName);
  const encodedFile = encodeURIComponent(filePath);
  // Block ID doesn't need encoding (UUID-safe)

  // Construct URI
  return `obsidian://open?vault=${encodedVault}&file=${encodedFile}&block=${blockId}`;
}
```

**Edge Cases**:
- Empty vault name → throws error (shouldn't happen)
- Empty file path → throws error (shouldn't happen)
- Missing block ID → throws error (caller should check first)
- Special characters in paths → handled by `encodeURIComponent()`

---

### 2. DESCRIPTION Field Formatting

**Input**:
- `uri: string` (Obsidian URI)
- `existingContent?: string` (optional existing DESCRIPTION content)

**Output**:
- `description: string` (formatted DESCRIPTION value)

**Transformation**:
```typescript
function buildDescriptionWithURI(uri: string, existingContent?: string): string {
  // For initial implementation, assume no existing content
  // Future enhancement: preserve existing content if present
  const prefix = existingContent ? `${existingContent}\n\n` : '\n\n';
  return `${prefix}Obsidian Link: ${uri}`;
}
```

**Formatting Rules**:
- If no existing content: `\n\nObsidian Link: {uri}`
- If existing content: `{existing}\n\nObsidian Link: {uri}`
- Two newlines before label for visual separation
- Label is fixed: `Obsidian Link:` (not localized)

**RFC 5545 Escaping** (applied before embedding in VTODO):
```typescript
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')   // Backslash
    .replace(/;/g, '\\;')     // Semicolon
    .replace(/,/g, '\\,')     // Comma
    .replace(/\n/g, '\\n');   // Newline (to literal \n in VTODO)
}

// Applied to full DESCRIPTION value before VTODO construction
const escapedDescription = escapeText(buildDescriptionWithURI(uri));
```

---

### 3. VTODO Construction with DESCRIPTION

**Input**:
- `task: Task` (Obsidian task object)
- `description?: string` (optional formatted DESCRIPTION)

**Output**:
- `vtodoString: string` (iCalendar VTODO format)

**Transformation** (extends existing `taskToVTODO` logic):
```typescript
function taskToVTODOWithDescription(task: Task, description?: string): string {
  const uid = generateUUID();
  const timestamp = formatTimestamp(new Date());
  const summary = escapeText(task.description);
  const status = task.status === 'completed' ? 'COMPLETED' : 'NEEDS-ACTION';

  let vtodo = `BEGIN:VTODO\n`;
  vtodo += `UID:${uid}\n`;
  vtodo += `DTSTAMP:${timestamp}\n`;
  vtodo += `SUMMARY:${summary}\n`;

  // NEW: Add DESCRIPTION if provided
  if (description) {
    const escapedDesc = escapeText(description);
    vtodo += `DESCRIPTION:${escapedDesc}\n`;
  }

  vtodo += `STATUS:${status}\n`;

  if (task.dueDate) {
    vtodo += `DUE;VALUE=DATE:${formatDate(task.dueDate)}\n`;
  }

  vtodo += `LAST-MODIFIED:${timestamp}\n`;
  vtodo += `END:VTODO\n`;

  return vtodo;
}
```

**Integration Point**: Modify `caldav/client.ts:createTask()` to accept optional `description` parameter.

---

## State Models

### 1. Task Sync State (No Changes)

**Description**: Existing sync state tracking via SyncMapping. No modifications needed.

**Existing Mapping**:
```typescript
interface SyncMapping {
  blockId: string;         // Obsidian task identifier
  caldavUid: string;       // CalDAV VTODO UID
  caldavHref: string;      // CalDAV resource URL
  caldavEtag: string;      // ETag for optimistic locking
  lastSyncTimestamp: number; // Last sync time (ms)
  lastObsidianHash: string;  // Content hash for change detection
  lastCalDAVModified: number; // LAST-MODIFIED from server
}
```

**Rationale**: Obsidian URI is derived on-demand, not stored. No persistent state needed beyond existing mapping.

---

### 2. DESCRIPTION Field Lifecycle

**State Diagram**:
```
[No DESCRIPTION]
      ↓
[Initial Sync] → [DESCRIPTION Created with URI]
      ↓
[Obsidian Update] → [CalDAV Update (Property Preservation)]
      ↓                            ↓
[DESCRIPTION Unchanged] ← [Read existing VTODO, preserve DESCRIPTION]
      ↓
[Subsequent Updates] → [DESCRIPTION Always Preserved]
```

**States**:
1. **Unsynced**: Task exists in Obsidian, not yet synced to CalDAV
2. **Initial Creation**: VTODO created with DESCRIPTION containing URI
3. **Steady State**: DESCRIPTION persists across all future updates
4. **Never Updated**: DESCRIPTION is set once and never modified by plugin

**Transition Events**:
- Unsynced → Initial Creation: First sync of task to CalDAV
- Initial Creation → Steady State: Property preservation activates on first update
- Steady State → Steady State: All subsequent updates preserve DESCRIPTION

---

## Data Flow Diagrams

### Full Sync Flow (Obsidian → CalDAV with URI)

```
┌─────────────────────────────────────────────────────────────────┐
│ Obsidian Vault                                                  │
│                                                                 │
│  - [ ] Task description ^task-uuid                              │
│    File: Projects/tasks.md                                      │
└─────────────────────────────────────────────────────────────────┘
                           ↓
                  [Task Scanner/Parser]
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ Task Object                                                     │
│  {                                                              │
│    description: "Task description",                             │
│    blockId: "task-uuid",                                        │
│    filePath: "Projects/tasks.md",                               │
│    status: "open",                                              │
│    dueDate: "2026-01-30"                                        │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                           ↓
                  [Sync Engine: createTaskOnCalDAV]
                           ↓
            ┌──────────────┴──────────────┐
            ↓                             ↓
    [Get Vault Name]              [Validate Block ID]
    vault.getName()                isValidBlockId()
    → "My Vault"                   → true
            ↓                             ↓
            └──────────────┬──────────────┘
                           ↓
                  [URI Builder Service]
                  buildObsidianURI(vaultName, filePath, blockId)
                           ↓
                  obsidian://open?vault=...&file=...&block=...
                           ↓
                  [Description Formatter]
                  buildDescriptionWithURI(uri)
                           ↓
                  "\n\nObsidian Link: {uri}"
                           ↓
                  [VTODO Constructor]
                  taskToVTODO(task, description)
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ VTODO Object                                                    │
│  BEGIN:VTODO                                                    │
│  UID:{uuid}                                                     │
│  SUMMARY:Task description                                       │
│  DESCRIPTION:\n\nObsidian Link: obsidian://open?...            │
│  STATUS:NEEDS-ACTION                                            │
│  DUE;VALUE=DATE:20260130                                        │
│  END:VTODO                                                      │
└─────────────────────────────────────────────────────────────────┘
                           ↓
                  [CalDAV Client]
                  createTask(vtodoData)
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ CalDAV Server                                                   │
│  - Task stored with DESCRIPTION containing Obsidian URI        │
└─────────────────────────────────────────────────────────────────┘
```

### Update Flow (Property Preservation)

```
┌─────────────────────────────────────────────────────────────────┐
│ Obsidian: Task updated (status changed to completed)           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
                  [Sync Engine: updateCalDAVTask]
                           ↓
                  [Convert Task to VTODO Properties]
                  { summary, status, due } (NO description)
                           ↓
                  [CalDAV Client: updateTaskWithPreservation]
                           ↓
            ┌──────────────┴──────────────┐
            ↓                             ↓
    [Fetch Existing VTODO]     [Property Preservation Pattern]
    GET from CalDAV server      - Read full VTODO
            ↓                   - Replace: SUMMARY, STATUS, DUE
            ↓                   - Preserve: DESCRIPTION, custom fields
            ↓                             ↓
            └──────────────┬──────────────┘
                           ↓
                  [Reconstructed VTODO with Preserved DESCRIPTION]
                           ↓
                  PUT to CalDAV server
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ CalDAV Server                                                   │
│  - Task updated with new status                                 │
│  - DESCRIPTION with Obsidian URI remains unchanged ✓            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Validation & Constraints

### Input Validation

| Field | Validation Rule | Error Handling |
|-------|----------------|----------------|
| `blockId` | Must match UUID format: `task-{uuid}` | Skip URI generation, log warning |
| `vaultName` | Non-empty string | Skip URI generation, log error |
| `filePath` | Non-empty string | Skip URI generation, log error |
| `description` (VTODO) | Optional; if present, must contain label | No validation (trusted output) |

### Business Rules

1. **One URI per task**: Each task has at most one Obsidian URI (never duplicate)
2. **Immutable URIs**: Once created, URIs never change (even if files move)
3. **Unidirectional flow**: URIs flow Obsidian→CalDAV only, never back
4. **Initial sync only**: DESCRIPTION is set during creation, never updated
5. **Graceful degradation**: Missing block ID skips URI generation but allows task sync

### Constraints

- **Performance**: URI generation must complete in <5ms per task
- **Memory**: No additional in-memory storage for URIs (computed on-demand)
- **Network**: No additional HTTP requests (URI generation is local)
- **Storage**: No plugin data changes (no new persistent state)

---

## Summary

The feature introduces minimal data model changes:

1. **New Computed Entity**: Obsidian URI (not stored, derived from existing Task properties)
2. **Extended Field**: VTODO DESCRIPTION (new usage of existing RFC 5545 field)
3. **No Persistent State**: No changes to SyncMapping or plugin data storage
4. **Simple Transformations**: URI construction + DESCRIPTION formatting + RFC 5545 escaping
5. **Leverages Existing Patterns**: Property preservation handles DESCRIPTION lifecycle automatically

**Next Phase**: Define function contracts and API signatures in `contracts/`.

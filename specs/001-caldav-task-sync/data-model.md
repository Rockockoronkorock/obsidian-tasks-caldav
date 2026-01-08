# Data Model

**Feature**: CalDAV Task Synchronization
**Date**: 2026-01-08
**Status**: Phase 1 Design

## Overview

This document defines the data entities and their relationships for the CalDAV task synchronization plugin. All entities are technology-agnostic and describe the domain model independent of implementation details.

---

## Core Entities

### 1. Task

Represents a task item found in the Obsidian vault using markdown syntax.

**Attributes:**
- `blockId: string` - Stable unique identifier (UUID v4 format: `task-[uuid]`)
- `filePath: string` - Vault-relative path to the markdown file containing this task
- `lineNumber: number` - Line number where the task appears in the file
- `description: string` - Text content of the task
- `dueDate: Date | null` - Optional due date (parsed from `📅 YYYY-MM-DD` format)
- `status: TaskStatus` - Completion status (open or completed)
- `rawLine: string` - Original markdown line for reconstruction
- `tags: string[]` - Inline tags extracted from the task line (e.g., `#work`, `#personal`)

**Relationships:**
- Has zero-or-one `SyncMapping` (if task has been synced to CalDAV)

**State Transitions:**
```
[Created] → [Open] ⇄ [Completed]
           ↓
       [Synced to CalDAV]
           ↓
       [Mapped & Tracked]
```

**Validation Rules:**
- `blockId` must be unique within the vault
- `blockId` format: `^task-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`
- `description` must not be empty
- `dueDate` if present, must be a valid Date object
- `status` must be either "open" or "completed"
- `filePath` must exist in the vault
- `lineNumber` must be positive integer

---

### 2. SyncMapping

Represents the bidirectional link between an Obsidian task and a CalDAV VTODO item. This entity tracks sync state and enables change detection.

**Attributes:**
- `blockId: string` - Reference to the Obsidian task's block ID
- `caldavUid: string` - Unique identifier of the VTODO on the CalDAV server
- `lastSyncTimestamp: Date` - When this task was last synchronized
- `lastKnownContentHash: string` - Hash of task content at last sync (for change detection)
- `lastKnownObsidianModified: Date` - Last modification timestamp from Obsidian
- `lastKnownCalDAVModified: Date` - Last modification timestamp from CalDAV server

**Relationships:**
- Belongs to exactly one `Task` (via `blockId`)
- References exactly one CalDAV VTODO (via `caldavUid`)

**Lifecycle:**
```
[Created on first sync] → [Updated on each subsequent sync] → [Orphaned if task deleted]
```

**Validation Rules:**
- `blockId` must reference an existing task
- `caldavUid` must not be empty
- `lastSyncTimestamp` must be a valid Date
- `lastKnownContentHash` must be a non-empty string
- Both modification timestamps must be valid Dates

**Change Detection Logic:**
- Compare `lastKnownContentHash` with current task content hash
- If different → task was modified in Obsidian
- Compare `lastKnownCalDAVModified` with current CalDAV LAST-MODIFIED
- If different → task was modified on CalDAV server
- If both modified → conflict, apply last-write-wins based on timestamps

---

### 3. CalDAVConfiguration

User-provided settings for connecting to the CalDAV server and controlling sync behavior.

**Attributes:**

**Connection Settings:**
- `serverUrl: string` - Base URL of the CalDAV server (must be HTTPS)
- `username: string` - Username for authentication
- `password: string` - Password or app-specific token
- `calendarPath: string` - Path to the calendar on the server (e.g., `/dav/calendars/user/tasks/`)

**Sync Settings:**
- `syncInterval: number` - Automatic sync interval in seconds (default: 60)
- `enableAutoSync: boolean` - Whether automatic background sync is enabled (default: true)

**Filter Settings:**
- `excludedFolders: string[]` - List of vault folder paths to exclude from sync (e.g., `["Archive/", "Templates/"]`)
- `excludedTags: string[]` - List of inline tags to exclude from sync (e.g., `["#private", "#local-only"]`)
- `completedTaskAgeDays: number` - Age threshold in days for completed tasks (default: 30)

**Validation Rules:**
- `serverUrl` must start with `https://`
- `serverUrl` must be a valid URL
- `username` must not be empty
- `password` must not be empty
- `syncInterval` must be >= 10 seconds (prevent server abuse)
- `excludedFolders` paths must end with `/`
- `excludedTags` must start with `#`
- `completedTaskAgeDays` must be >= 0

---

### 4. SyncFilter

Represents the filter evaluation logic applied to tasks before syncing. This is a computed entity based on CalDAVConfiguration.

**Attributes:**
- `excludedFolders: Set<string>` - Normalized set of excluded folder paths
- `excludedTags: Set<string>` - Normalized set of excluded tags
- `completedTaskAgeThreshold: Date` - Cutoff date for completed task inclusion

**Methods (Conceptual):**
- `shouldSync(task: Task): boolean` - Determines if a task passes all filters
- `matchesFolderExclusion(filePath: string): boolean` - Check folder exclusion
- `hasExcludedTag(tags: string[]): boolean` - Check tag exclusion
- `isCompletedTooOld(task: Task): boolean` - Check age threshold for completed tasks

**Filter Logic:**
```
Task passes filter IF:
  AND [NOT in excluded folder OR subfolder]
  AND [NOT contains any excluded tag]
  AND [IF completed: completionDate > ageThreshold]
```

---

### 5. CalDAVTask

Represents a VTODO item on the CalDAV server. This is the CalDAV-side representation of a task.

**Attributes:**
- `uid: string` - Unique identifier on CalDAV server
- `summary: string` - Task description (maps to Obsidian task description)
- `due: Date | null` - Due date (maps to Obsidian task dueDate)
- `status: VTODOStatus` - CalDAV status: "NEEDS-ACTION" or "COMPLETED"
- `lastModified: Date` - LAST-MODIFIED timestamp from CalDAV
- `etag: string` - ETag from CalDAV server (for optimistic concurrency)
- `href: string` - Full URL to this VTODO resource on the server

**Relationships:**
- Has zero-or-one `SyncMapping` (if task originated from Obsidian)

**Validation Rules:**
- `uid` must be unique on the CalDAV server
- `summary` must not be empty
- `status` must be "NEEDS-ACTION" or "COMPLETED"
- `lastModified` must be a valid Date
- `href` must be a valid URL

**VTODO Format Mapping:**
```
CalDAV VTODO ↔ Obsidian Task

SUMMARY       ↔ description
DUE           ↔ dueDate
STATUS        ↔ status ("NEEDS-ACTION" ↔ "open", "COMPLETED" ↔ "completed")
UID           ↔ (stored in SyncMapping.caldavUid)
LAST-MODIFIED ↔ (used for conflict detection)
```

---

## Entity Relationships

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     Task     │ 1   0..1 │ SyncMapping  │ 1   0..1 │ CalDAVTask   │
│              │────────│              │────────│              │
│ - blockId    │       │ - blockId    │       │ - uid        │
│ - description│       │ - caldavUid  │       │ - summary    │
│ - dueDate    │       │ - lastSync   │       │ - due        │
│ - status     │       │ - contentHash│       │ - status     │
└──────────────┘       └──────────────┘       └──────────────┘
       │
       │ 0..*
       │
       ▼
┌──────────────┐
│  SyncFilter  │
│              │
│ - excludedF..│
│ - excludedT..│
│ - ageThresh..│
└──────────────┘
       ▲
       │
       │ 1
       │
┌──────────────┐
│ CalDAVConfig │
│              │
│ - serverUrl  │
│ - username   │
│ - filters... │
└──────────────┘
```

---

## Data Flow

### Initial Sync Flow
```
1. Scan Vault → List<Task>
2. Apply SyncFilter → List<Task> (filtered)
3. For each filtered Task:
   - Generate blockId (if not present)
   - Create CalDAVTask
   - Upload to CalDAV server
   - Receive caldavUid
   - Create SyncMapping
   - Save SyncMapping to storage
```

### Bidirectional Sync Flow
```
1. Scan Vault → List<Task>
2. Fetch from CalDAV → List<CalDAVTask>
3. For each Task with SyncMapping:
   - Calculate contentHash
   - Compare with lastKnownContentHash
   - If changed → Obsidian-to-CalDAV sync
4. For each CalDAVTask with SyncMapping:
   - Compare lastModified with lastKnownCalDAVModified
   - If changed → CalDAV-to-Obsidian sync
5. Conflict Resolution:
   - If both changed → last-write-wins based on timestamps
```

---

## Storage Schema

### Plugin Data JSON Structure

```typescript
{
  "version": 1,
  "settings": {
    "serverUrl": "https://caldav.example.com",
    "username": "user@example.com",
    "password": "secret-app-password",
    "calendarPath": "/dav/calendars/user/tasks/",
    "syncInterval": 60,
    "enableAutoSync": true,
    "excludedFolders": ["Archive/", "Templates/"],
    "excludedTags": ["#private", "#local-only"],
    "completedTaskAgeDays": 30
  },
  "syncState": {
    "mappings": {
      "task-a1b2c3d4-e5f6-7890-abcd-ef1234567890": {
        "caldavUid": "uuid-on-caldav-server-12345",
        "lastSyncTimestamp": "2026-01-08T12:00:00Z",
        "lastKnownContentHash": "abc123def456",
        "lastKnownObsidianModified": "2026-01-08T11:55:00Z",
        "lastKnownCalDAVModified": "2026-01-08T11:55:00Z"
      }
    }
  }
}
```

### Size Estimates
- Per mapping: ~250 bytes
- 1000 tasks: ~250KB
- Acceptable for plugin data storage

---

## Type Definitions

```typescript
// Enums
enum TaskStatus {
  Open = "open",
  Completed = "completed"
}

enum VTODOStatus {
  NeedsAction = "NEEDS-ACTION",
  Completed = "COMPLETED"
}

// Interfaces
interface Task {
  blockId: string;
  filePath: string;
  lineNumber: number;
  description: string;
  dueDate: Date | null;
  status: TaskStatus;
  rawLine: string;
  tags: string[];
}

interface SyncMapping {
  blockId: string;
  caldavUid: string;
  lastSyncTimestamp: Date;
  lastKnownContentHash: string;
  lastKnownObsidianModified: Date;
  lastKnownCalDAVModified: Date;
}

interface CalDAVConfiguration {
  serverUrl: string;
  username: string;
  password: string;
  calendarPath: string;
  syncInterval: number;
  enableAutoSync: boolean;
  excludedFolders: string[];
  excludedTags: string[];
  completedTaskAgeDays: number;
}

interface CalDAVTask {
  uid: string;
  summary: string;
  due: Date | null;
  status: VTODOStatus;
  lastModified: Date;
  etag: string;
  href: string;
}
```

---

## Constraints & Invariants

1. **Uniqueness Constraints:**
   - Task.blockId must be unique across all tasks
   - CalDAVTask.uid must be unique on the CalDAV server
   - SyncMapping must have unique blockId (one mapping per task)

2. **Referential Integrity:**
   - SyncMapping.blockId must reference an existing Task
   - SyncMapping.caldavUid should reference an existing CalDAVTask (soft constraint - orphans allowed temporarily)

3. **Filter Consistency:**
   - A task that passes filters at sync time may fail filters later (filters are evaluated at sync time only)
   - Filters do NOT trigger removal of already-synced tasks

4. **Timestamp Monotonicity:**
   - lastSyncTimestamp should always increase or stay the same
   - lastKnownObsidianModified and lastKnownCalDAVModified should reflect actual modification times

---

**Data Model Version**: 1.0
**Compatible with Spec**: [spec.md](./spec.md) (2026-01-08)
**Next Phase**: Implementation (after `/speckit.tasks`)

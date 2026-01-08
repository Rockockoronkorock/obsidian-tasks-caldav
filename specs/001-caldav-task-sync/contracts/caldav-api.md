# CalDAV API Contract

**Feature**: CalDAV Task Synchronization
**Date**: 2026-01-08
**Status**: Phase 1 Design

## Overview

This document defines the external API contract between the Obsidian plugin and CalDAV servers. It specifies the HTTP operations, VTODO format, authentication mechanisms, and error handling for CalDAV task synchronization.

**Library Used**: `tsdav` (see [research.md](../research.md) for rationale)

---

## CalDAV Protocol Basics

**Standard**: RFC 4791 (CalDAV), RFC 5545 (iCalendar), RFC 6638 (CalDAV Scheduling Extensions for Tasks)

**Base Concepts**:
- CalDAV uses HTTP with WebDAV extensions
- Resources are identified by URLs (href)
- Tasks are represented as VTODO components in iCalendar format
- ETags are used for optimistic concurrency control
- PROPFIND and REPORT methods query collections
- PUT creates/updates resources
- DELETE removes resources

---

## Authentication

### HTTP Basic Authentication

**Header Format**:
```http
Authorization: Basic <base64(username:password)>
```

**Example**:
```typescript
const credentials = btoa(`${username}:${password}`);
const headers = {
  'Authorization': `Basic ${credentials}`
};
```

**tsdav Implementation**:
```typescript
import { createDAVClient } from 'tsdav';

const client = await createDAVClient({
  serverUrl: 'https://caldav.example.com',
  credentials: {
    username: 'user@example.com',
    password: 'secret-app-password'
  },
  authMethod: 'Basic',
  defaultAccountType: 'caldav'
});
```

### Security Requirements

- **HTTPS Only**: All requests MUST use HTTPS (validated in CalDAVConfiguration)
- **App-Specific Passwords**: Recommend users create app-specific passwords
- **No Credential Logging**: Never log credentials in error messages or debug output

---

## VTODO Format Specification

### Minimal VTODO Structure

This is the subset of VTODO properties used by the plugin:

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Obsidian Tasks CalDAV Plugin//EN
BEGIN:VTODO
UID:uuid-generated-by-caldav-server
DTSTAMP:20260108T120000Z
SUMMARY:Buy milk
DUE:20260115T000000Z
STATUS:NEEDS-ACTION
LAST-MODIFIED:20260108T120000Z
END:VTODO
END:VCALENDAR
```

### Property Mappings

| VTODO Property | Obsidian Task Field | Data Type | Required | Notes |
|----------------|---------------------|-----------|----------|-------|
| `UID` | SyncMapping.caldavUid | string | ✅ Yes | Unique identifier on CalDAV server |
| `SUMMARY` | Task.description | string | ✅ Yes | Task description text |
| `DUE` | Task.dueDate | Date \| null | ❌ No | Due date (YYYYMMDD or YYYYMMDDTHHMMSSZ) |
| `STATUS` | Task.status | enum | ✅ Yes | "NEEDS-ACTION" or "COMPLETED" |
| `LAST-MODIFIED` | (tracking only) | Date | ✅ Yes | Used for conflict detection |
| `DTSTAMP` | (auto-generated) | Date | ✅ Yes | Timestamp of VTODO creation |

### Status Value Mapping

```typescript
// Obsidian → CalDAV
TaskStatus.Open → "NEEDS-ACTION"
TaskStatus.Completed → "COMPLETED"

// CalDAV → Obsidian
"NEEDS-ACTION" → TaskStatus.Open
"IN-PROCESS" → TaskStatus.Open (treat as open)
"COMPLETED" → TaskStatus.Completed
"CANCELLED" → TaskStatus.Completed (treat as completed)
```

### Date Format Handling

**CalDAV DUE Format**: ISO 8601 date or datetime

**Two formats supported**:
1. **Date-only** (all-day task): `DUE;VALUE=DATE:20260115`
2. **DateTime** (specific time): `DUE:20260115T140000Z`

**Plugin Approach**: Use date-only format since Obsidian Tasks plugin doesn't support times

```typescript
// Obsidian → CalDAV
function toCalDAVDueDate(date: Date | null): string | undefined {
  if (!date) return undefined;

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}${month}${day}`; // e.g., "20260115"
}

// CalDAV → Obsidian
function parseCalDAVDueDate(dueDateString: string): Date | null {
  if (!dueDateString) return null;

  // Handle both DATE and DATETIME formats
  // DATE: "20260115"
  // DATETIME: "20260115T140000Z"
  const dateMatch = dueDateString.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!dateMatch) return null;

  const [, year, month, day] = dateMatch;
  return new Date(`${year}-${month}-${day}T00:00:00Z`);
}
```

### Example VTODO Conversions

**Case 1: Open Task with Due Date**

Obsidian:
```markdown
- [ ] Buy milk 📅 2026-01-15 ^task-a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

CalDAV (VTODO):
```ics
BEGIN:VTODO
UID:uuid-on-caldav-server-12345
SUMMARY:Buy milk
DUE;VALUE=DATE:20260115
STATUS:NEEDS-ACTION
DTSTAMP:20260108T120000Z
LAST-MODIFIED:20260108T120000Z
END:VTODO
```

**Case 2: Completed Task (No Due Date)**

Obsidian:
```markdown
- [x] Call dentist ^task-b2c3d4e5-f6a7-8901-bcde-f12345678901
```

CalDAV (VTODO):
```ics
BEGIN:VTODO
UID:uuid-on-caldav-server-67890
SUMMARY:Call dentist
STATUS:COMPLETED
DTSTAMP:20260108T120000Z
LAST-MODIFIED:20260108T130000Z
COMPLETED:20260108T130000Z
END:VTODO
```

---

## HTTP Operations

### 1. Discover Calendar Home

**Purpose**: Find the user's calendar collection URL

**Method**: `PROPFIND`

**Request**:
```http
PROPFIND /dav/ HTTP/1.1
Host: caldav.example.com
Depth: 0
Content-Type: application/xml

<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set />
  </d:prop>
</d:propfind>
```

**Response** (Success):
```http
HTTP/1.1 207 Multi-Status
Content-Type: application/xml

<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/dav/calendars/user@example.com/</d:href>
    <d:propstat>
      <d:prop>
        <c:calendar-home-set>
          <d:href>/dav/calendars/user@example.com/</d:href>
        </c:calendar-home-set>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>
```

**tsdav Abstraction**:
```typescript
// tsdav handles discovery automatically
const calendars = await client.fetchCalendars();
const taskCalendar = calendars.find(cal => cal.displayName === 'Tasks');
```

---

### 2. List Tasks (Fetch All VTODOs)

**Purpose**: Retrieve all tasks from the CalDAV calendar

**Method**: `REPORT` with `calendar-query`

**Request**:
```http
REPORT /dav/calendars/user@example.com/tasks/ HTTP/1.1
Host: caldav.example.com
Depth: 1
Content-Type: application/xml

<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VTODO" />
    </c:comp-filter>
  </c:filter>
</c:calendar-query>
```

**Response** (Success):
```http
HTTP/1.1 207 Multi-Status
Content-Type: application/xml

<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/dav/calendars/user@example.com/tasks/uuid-12345.ics</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"abc123def456"</d:getetag>
        <c:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
UID:uuid-12345
SUMMARY:Buy milk
DUE;VALUE=DATE:20260115
STATUS:NEEDS-ACTION
LAST-MODIFIED:20260108T120000Z
END:VTODO
END:VCALENDAR</c:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>
```

**tsdav Abstraction**:
```typescript
const todos = await client.fetchCalendarObjects({
  calendar: taskCalendar,
  objectType: 'VTODO'
});

// todos is an array of:
// {
//   url: string,
//   data: string (iCalendar format),
//   etag: string
// }
```

---

### 3. Create Task (Upload VTODO)

**Purpose**: Create a new task on the CalDAV server

**Method**: `PUT`

**Request**:
```http
PUT /dav/calendars/user@example.com/tasks/new-uuid.ics HTTP/1.1
Host: caldav.example.com
Content-Type: text/calendar; charset=utf-8
If-None-Match: *

BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Obsidian Tasks CalDAV Plugin//EN
BEGIN:VTODO
UID:new-uuid
DTSTAMP:20260108T120000Z
SUMMARY:New task from Obsidian
STATUS:NEEDS-ACTION
END:VTODO
END:VCALENDAR
```

**Response** (Success):
```http
HTTP/1.1 201 Created
ETag: "xyz789"
```

**Response** (Conflict - Resource Exists):
```http
HTTP/1.1 412 Precondition Failed
```

**tsdav Abstraction**:
```typescript
const vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Obsidian Tasks CalDAV Plugin//EN
BEGIN:VTODO
UID:${caldavUid}
DTSTAMP:${timestamp}
SUMMARY:${task.description}
DUE;VALUE=DATE:${dueDateString}
STATUS:NEEDS-ACTION
END:VTODO
END:VCALENDAR`;

const result = await client.createCalendarObject({
  calendar: taskCalendar,
  filename: `${caldavUid}.ics`,
  iCalString: vtodoString
});

// result contains: { url, etag }
```

---

### 4. Update Task (Modify VTODO)

**Purpose**: Update an existing task on the CalDAV server

**Method**: `PUT` with `If-Match` header (optimistic locking)

**Request**:
```http
PUT /dav/calendars/user@example.com/tasks/uuid-12345.ics HTTP/1.1
Host: caldav.example.com
Content-Type: text/calendar; charset=utf-8
If-Match: "abc123def456"

BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Obsidian Tasks CalDAV Plugin//EN
BEGIN:VTODO
UID:uuid-12345
DTSTAMP:20260108T120000Z
SUMMARY:Buy milk and eggs
DUE;VALUE=DATE:20260115
STATUS:NEEDS-ACTION
LAST-MODIFIED:20260108T130000Z
END:VTODO
END:VCALENDAR
```

**Response** (Success):
```http
HTTP/1.1 204 No Content
ETag: "newetag456"
```

**Response** (Conflict - ETag Mismatch)**:
```http
HTTP/1.1 412 Precondition Failed
```

**Conflict Handling**: If 412 is returned, the server's version has changed. Plugin should:
1. Fetch the latest version from the server
2. Apply conflict resolution (last-write-wins based on timestamps)
3. Retry the update with the new ETag

**tsdav Abstraction**:
```typescript
await client.updateCalendarObject({
  calendarObject: {
    url: taskUrl,
    data: updatedVTODOString,
    etag: currentEtag
  }
});
```

---

### 5. Delete Task (Remove VTODO)

**Purpose**: Delete a task from the CalDAV server

**Method**: `DELETE`

**Request**:
```http
DELETE /dav/calendars/user@example.com/tasks/uuid-12345.ics HTTP/1.1
Host: caldav.example.com
```

**Response** (Success):
```http
HTTP/1.1 204 No Content
```

**Response** (Not Found):
```http
HTTP/1.1 404 Not Found
```

**tsdav Abstraction**:
```typescript
await client.deleteCalendarObject({
  calendarObject: {
    url: taskUrl,
    etag: currentEtag
  }
});
```

---

## Error Handling

### HTTP Status Codes

| Status Code | Meaning | Plugin Action |
|-------------|---------|---------------|
| **200 OK** | Success (with body) | Parse response data |
| **201 Created** | Resource created | Update sync mapping with new href/etag |
| **204 No Content** | Success (no body) | Update sync state, continue |
| **401 Unauthorized** | Authentication failed | Show error notification, disable auto-sync |
| **403 Forbidden** | Insufficient permissions | Show error notification |
| **404 Not Found** | Resource doesn't exist | Remove sync mapping (orphaned) |
| **412 Precondition Failed** | ETag mismatch | Re-fetch and retry with conflict resolution |
| **500 Internal Server Error** | Server error | Retry with exponential backoff |
| **503 Service Unavailable** | Server temporarily unavailable | Retry with exponential backoff |

### Error Response Format

CalDAV errors typically return XML in the response body:

```xml
<?xml version="1.0" encoding="utf-8" ?>
<d:error xmlns:d="DAV:">
  <d:response-description>
    The requested resource was not found.
  </d:response-description>
</d:error>
```

### Retry Strategy

**Transient Errors** (500, 503, network timeout):
- Retry up to 3 times
- Exponential backoff: 1s, 2s, 4s
- After 3 failures, notify user and abort sync cycle

**Authentication Errors** (401):
- Do NOT retry (credentials are wrong)
- Disable automatic sync
- Show persistent notification with instructions

**Rate Limiting** (429 Too Many Requests):
- Respect `Retry-After` header
- Disable automatic sync temporarily
- Resume after waiting period

**Implementation Example**:
```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry auth errors
      if (error.status === 401 || error.status === 403) {
        throw error;
      }

      // Retry transient errors
      if (error.status >= 500 || error.name === 'NetworkError') {
        const backoffMs = Math.pow(2, attempt) * 1000;
        await sleep(backoffMs);
        continue;
      }

      // Don't retry other errors
      throw error;
    }
  }

  throw lastError;
}
```

---

## CalDAV Server Compatibility

### Tested Servers

| Server | Version | Status | Notes |
|--------|---------|--------|-------|
| **Nextcloud** | 27+ | ✅ Recommended | Full VTODO support, app passwords |
| **Radicale** | 3.0+ | ✅ Supported | Lightweight, self-hosted |
| **Baikal** | 0.9+ | ✅ Supported | Lightweight, LAMP stack |
| **Apple Calendar** | iCloud | ⚠️ Untested | Should work (standard CalDAV) |
| **Google Calendar** | - | ❌ Not Supported | No VTODO support |

### Server-Specific Notes

**Nextcloud**:
- Supports app-specific passwords (recommended)
- Calendar path: `/remote.php/dav/calendars/{username}/{calendar-name}/`
- Excellent CalDAV compliance

**Radicale**:
- Simple authentication (username/password)
- Calendar path: `/{username}/{calendar-name}/`
- No app passwords

**Baikal**:
- Simple authentication
- Calendar path: `/dav.php/calendars/{username}/{calendar-name}/`

---

## Integration Points

### SyncEngine ↔ CalDAVClient

```typescript
interface CalDAVClient {
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;

  // CRUD Operations
  fetchAllTasks(): Promise<CalDAVTask[]>;
  createTask(task: Task): Promise<CalDAVTask>;
  updateTask(caldavUid: string, task: Task, etag: string): Promise<CalDAVTask>;
  deleteTask(caldavUid: string, etag: string): Promise<void>;
}

interface CalDAVTask {
  uid: string;           // UID from VTODO
  summary: string;       // SUMMARY
  due: Date | null;      // DUE
  status: VTODOStatus;   // STATUS
  lastModified: Date;    // LAST-MODIFIED
  etag: string;          // ETag from HTTP response
  href: string;          // Full URL to this resource
}
```

### Error Types

```typescript
class CalDAVError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public serverMessage?: string
  ) {
    super(message);
    this.name = 'CalDAVError';
  }
}

class CalDAVAuthError extends CalDAVError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'CalDAVAuthError';
  }
}

class CalDAVNetworkError extends CalDAVError {
  constructor(message: string) {
    super(message);
    this.name = 'CalDAVNetworkError';
  }
}

class CalDAVConflictError extends CalDAVError {
  constructor(message: string, public currentEtag: string) {
    super(message, 412);
    this.name = 'CalDAVConflictError';
  }
}
```

---

## Testing Strategy

### Unit Tests

Mock CalDAV server responses:

```typescript
import { vi } from 'vitest';

// Mock tsdav client
vi.mock('tsdav', () => ({
  createDAVClient: vi.fn(() => ({
    fetchCalendars: vi.fn().mockResolvedValue([
      { displayName: 'Tasks', url: '/calendars/tasks/' }
    ]),
    fetchCalendarObjects: vi.fn().mockResolvedValue([
      {
        url: '/calendars/tasks/uuid-123.ics',
        data: 'BEGIN:VCALENDAR...',
        etag: '"abc123"'
      }
    ])
  }))
}));
```

### Integration Tests

Use a local Radicale server for integration tests:

```bash
# Start test CalDAV server
docker run -d -p 5232:5232 tomsquest/docker-radicale

# Configure test client
serverUrl: 'http://localhost:5232'
username: 'test'
password: 'test'
```

### Manual Testing Checklist

- [ ] Connect to Nextcloud CalDAV server
- [ ] Sync 100+ tasks successfully
- [ ] Handle network disconnection gracefully
- [ ] Handle invalid credentials (401 error)
- [ ] Handle concurrent modifications (412 conflict)
- [ ] Verify VTODO format on server matches expectations
- [ ] Test on mobile (iOS/Android)

---

**Contract Version**: 1.0
**Compatible with**: [data-model.md](../data-model.md) v1.0, [spec.md](../spec.md) (2026-01-08)
**Library**: tsdav (see [research.md](../research.md))


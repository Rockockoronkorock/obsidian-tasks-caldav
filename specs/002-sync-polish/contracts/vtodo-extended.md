# Extended VTODO Contract

**Feature**: Sync Polish - VTODO Property Preservation
**Date**: 2026-01-14
**Status**: Phase 1 Design

## Overview

This contract defines how the plugin handles VTODO iCalendar data to preserve extended properties that are not managed by Obsidian. The goal is to ensure that modifications made to tasks via Obsidian do not destroy metadata added by other CalDAV clients.

---

## iCalendar VTODO Format (RFC 5545)

### Standard VTODO Structure

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Product ID//EN
BEGIN:VTODO
UID:unique-identifier
DTSTAMP:YYYYMMDDTHHMMSSZ
SUMMARY:Task description
STATUS:NEEDS-ACTION|COMPLETED|IN-PROCESS|CANCELLED
[optional properties...]
END:VTODO
END:VCALENDAR
```

### Property Categories

#### Managed Properties (Modified by Obsidian)

| Property | Format | Obsidian Mapping | Notes |
|----------|--------|------------------|-------|
| `SUMMARY` | `SUMMARY:text` | Task description | Plain text, no folding |
| `DUE` | `DUE;VALUE=DATE:YYYYMMDD` | Due date | Date-only format |
| `STATUS` | `STATUS:NEEDS-ACTION\|COMPLETED` | Open/Completed | Only two values used |
| `LAST-MODIFIED` | `LAST-MODIFIED:YYYYMMDDTHHMMSSZ` | Auto-updated | ISO 8601 UTC |
| `DTSTAMP` | `DTSTAMP:YYYYMMDDTHHMMSSZ` | Auto-updated | ISO 8601 UTC |

#### Preserved Properties (Never Modified)

| Property | Format | Purpose |
|----------|--------|---------|
| `UID` | `UID:string` | Unique identifier - NEVER change |
| `PRODID` | `PRODID:-//Company//Product//EN` | Creating application |
| `CATEGORIES` | `CATEGORIES:cat1,cat2` | Task categories |
| `PRIORITY` | `PRIORITY:0-9` | Priority (0=undefined, 1=highest, 9=lowest) |
| `DESCRIPTION` | `DESCRIPTION:text` | Extended description |
| `PERCENT-COMPLETE` | `PERCENT-COMPLETE:0-100` | Completion percentage |
| `RELATED-TO` | `RELATED-TO:parent-uid` | Task relationships |
| `ATTENDEE` | `ATTENDEE:mailto:email` | Assigned users |
| `ORGANIZER` | `ORGANIZER:mailto:email` | Task creator |
| `ATTACH` | `ATTACH:uri` | File attachments |
| `GEO` | `GEO:lat;lon` | Geographic location |
| `LOCATION` | `LOCATION:text` | Text location |
| `SEQUENCE` | `SEQUENCE:number` | Revision sequence |
| `CLASS` | `CLASS:PUBLIC\|PRIVATE\|CONFIDENTIAL` | Access classification |
| `COMMENT` | `COMMENT:text` | Comments |
| `CONTACT` | `CONTACT:text` | Contact information |
| `X-*` | `X-VENDOR-PROP:value` | Custom vendor properties |

---

## Property Replacement Contract

### Input/Output

```typescript
function updateVTODOProperties(
  existingVTODO: string,  // Raw iCalendar string from CalDAV
  summary: string,        // New task description
  due: Date | null,       // New due date or null
  status: VTODOStatus     // New status
): string                 // Modified iCalendar string
```

### Replacement Rules

1. **SUMMARY**: Always replace entire property line
   - Pattern: `/SUMMARY:[^\r\n]+/`
   - Replacement: `SUMMARY:${escapeICalText(summary)}`

2. **STATUS**: Always replace entire property line
   - Pattern: `/STATUS:[^\r\n]+/`
   - Replacement: `STATUS:${status}`
   - If not present: Insert before `END:VTODO`

3. **DUE**: Conditional replacement
   - If `due` is not null:
     - Pattern: `/DUE[;:][^\r\n]+/` (matches `DUE:` or `DUE;VALUE=DATE:`)
     - Replacement: `DUE;VALUE=DATE:${formatDate(due)}`
     - If not present: Insert before `END:VTODO`
   - If `due` is null:
     - Remove existing DUE property line

4. **LAST-MODIFIED**: Always update to current timestamp
   - Pattern: `/LAST-MODIFIED:[^\r\n]+/`
   - Replacement: `LAST-MODIFIED:${currentTimestamp()}`

5. **DTSTAMP**: Always update to current timestamp
   - Pattern: `/DTSTAMP:[^\r\n]+/`
   - Replacement: `DTSTAMP:${currentTimestamp()}`

### Preservation Rules

1. **Do not modify** any property not listed in Replacement Rules
2. **Do not add** properties that weren't in the original
3. **Preserve line order** - property order should be maintained
4. **Preserve formatting** - line endings, folding should be maintained
5. **Preserve unknown properties** - any `X-*` or unrecognized properties remain intact

---

## Text Escaping Contract

### iCalendar Text Escaping (RFC 5545 Section 3.3.11)

When writing text to SUMMARY or other text properties:

| Character | Escape Sequence |
|-----------|-----------------|
| `\` | `\\` |
| `;` | `\;` |
| `,` | `\,` |
| `\n` | `\n` (literal backslash-n) |

### Implementation

```typescript
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function unescapeICalText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}
```

---

## Date Format Contract

### CalDAV Date Formats

| Format | Example | Usage |
|--------|---------|-------|
| Date-only | `DUE;VALUE=DATE:20260115` | Obsidian due dates |
| DateTime UTC | `DUE:20260115T140000Z` | Preserve if received |
| DateTime Local | `DUE:20260115T140000` | Preserve if received |
| DateTime with TZ | `DUE;TZID=America/New_York:20260115T140000` | Preserve if received |

### Implementation

```typescript
function formatDateForCalDAV(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}
```

---

## Fetch Raw Data Contract

### CalDAVClient.fetchTaskRawData()

```typescript
/**
 * Fetch the raw iCalendar string for a task
 * @param uid The CalDAV UID of the task
 * @returns The raw VTODO iCalendar string, or null if not found
 */
async fetchTaskRawData(uid: string): Promise<string | null>
```

### Implementation Requirements

1. Must fetch from CalDAV server (not cache)
2. Must return the complete VCALENDAR/VTODO string
3. Must return null if task not found
4. Must handle network errors gracefully

---

## Update Task Contract

### CalDAVClient.updateTaskWithPreservation()

```typescript
/**
 * Update a task while preserving extended properties
 * @param caldavUid The CalDAV UID
 * @param summary New task description
 * @param due New due date (or null)
 * @param status New status
 * @param etag Current ETag for optimistic locking
 * @param href Resource URL
 * @returns Updated CalDAVTask
 */
async updateTaskWithPreservation(
  caldavUid: string,
  summary: string,
  due: Date | null,
  status: VTODOStatus,
  etag: string,
  href: string
): Promise<CalDAVTask>
```

### Implementation Flow

```
1. Fetch raw VTODO data via fetchTaskRawData(caldavUid)
2. If not found, throw error (task deleted on server?)
3. Call updateVTODOProperties(rawData, summary, due, status)
4. Send modified data to server via updateCalendarObject()
5. Return updated CalDAVTask with new etag
```

---

## Error Handling

### Preservation Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Task not found | Deleted on server | Throw error, let sync engine handle |
| Network timeout | Server unresponsive | Retry with backoff |
| Regex match failure | Malformed VTODO | Fall back to full replacement |
| Property duplication | Bug in replacement | Validate output before sending |

### Validation

After property replacement, validate:
1. Exactly one `UID` property
2. Exactly one `SUMMARY` property
3. Exactly one `STATUS` property
4. At most one `DUE` property
5. `BEGIN:VTODO` and `END:VTODO` present

---

## Example Transformation

### Input (fetched from CalDAV)

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nextcloud Tasks//EN
BEGIN:VTODO
UID:550e8400-e29b-41d4-a716-446655440000
DTSTAMP:20260110T080000Z
CREATED:20260110T080000Z
LAST-MODIFIED:20260113T100000Z
SUMMARY:Review quarterly report
STATUS:NEEDS-ACTION
DUE;VALUE=DATE:20260120
CATEGORIES:Work,Finance
PRIORITY:2
DESCRIPTION:Check all sections and update charts
X-OC-HIDESUBTASKS:0
END:VTODO
END:VCALENDAR
```

### Obsidian Changes

- Description: `Review quarterly report` → `Review and finalize quarterly report`
- Status: `NEEDS-ACTION` → `COMPLETED`

### Output (sent to CalDAV)

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nextcloud Tasks//EN
BEGIN:VTODO
UID:550e8400-e29b-41d4-a716-446655440000
DTSTAMP:20260114T150000Z
CREATED:20260110T080000Z
LAST-MODIFIED:20260114T150000Z
SUMMARY:Review and finalize quarterly report
STATUS:COMPLETED
DUE;VALUE=DATE:20260120
CATEGORIES:Work,Finance
PRIORITY:2
DESCRIPTION:Check all sections and update charts
X-OC-HIDESUBTASKS:0
END:VTODO
END:VCALENDAR
```

**Preserved:**
- CATEGORIES: `Work,Finance`
- PRIORITY: `2`
- DESCRIPTION: `Check all sections and update charts`
- X-OC-HIDESUBTASKS: `0`
- CREATED timestamp

---

**Contract Version**: 1.0
**Compatible with Data Model**: [data-model.md](../data-model.md) v1.1
**Implementation Phase**: Phase 2 (/speckit.tasks)

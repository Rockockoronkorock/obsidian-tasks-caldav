# Data Model

**Feature**: Sync Polish - Notifications, Logging & Data Preservation
**Date**: 2026-01-14
**Status**: Phase 1 Design

## Overview

This document describes the data model extensions and modifications required for the sync polish feature. This builds upon the existing data model from `001-caldav-task-sync` and introduces minimal changes to support debug logging configuration and VTODO property preservation.

---

## Modified Entities

### 1. CalDAVConfiguration (Extended)

The existing CalDAVConfiguration entity is extended with one new attribute for debug logging control.

**New Attribute:**
- `enableDebugLogging: boolean` - Controls whether verbose debug logs are output to browser console

**Updated Type Definition:**

```typescript
interface CalDAVConfiguration {
  // Connection Settings (existing)
  serverUrl: string;
  username: string;
  password: string;
  calendarPath: string;

  // Sync Settings (existing)
  syncInterval: number;
  enableAutoSync: boolean;

  // Filter Settings (existing)
  excludedFolders: string[];
  excludedTags: string[];
  completedTaskAgeDays: number;

  // NEW: Logging Settings
  enableDebugLogging: boolean;
}
```

**Validation Rules:**
- `enableDebugLogging` must be boolean (defaults to `false` if undefined)

**Default Value:**
```typescript
enableDebugLogging: false
```

**Backward Compatibility:**
- Existing installations without this setting will use default `false`
- No migration required - undefined/missing value treated as `false`

---

## New Entities

### 2. ExtendedVTODO (Conceptual)

Represents a VTODO item that may contain extended properties beyond what Obsidian manages. This is a conceptual entity used during sync operations to preserve CalDAV data.

**Attributes:**

*Managed Properties (modified by Obsidian):*
- `summary: string` - Task description (SUMMARY property)
- `due: Date | null` - Due date (DUE property)
- `status: VTODOStatus` - Completion status (STATUS property)
- `lastModified: string` - Modification timestamp (LAST-MODIFIED property)
- `dtstamp: string` - Timestamp stamp (DTSTAMP property)

*Identity Properties (preserved, never modified):*
- `uid: string` - Unique identifier (UID property)
- `prodid: string` - Product identifier (PRODID property)

*Extended Properties (preserved verbatim):*
- `categories: string[]` - Task categories (CATEGORIES property)
- `priority: number` - Task priority 0-9 (PRIORITY property)
- `description: string` - Extended description (DESCRIPTION property)
- `customProperties: Map<string, string>` - Any X-* or other properties

**Lifecycle:**
```
[Created on CalDAV] → [Fetched with all properties] → [Managed properties updated] → [All properties preserved on save]
```

**Note:** ExtendedVTODO is not stored locally. It exists only during sync operations as an in-memory representation of the raw iCalendar data from the CalDAV server.

---

## Storage Schema Updates

### Plugin Data JSON Structure

```typescript
{
  "version": 1,
  "settings": {
    // Existing fields...
    "serverUrl": "https://caldav.example.com",
    "username": "user@example.com",
    "password": "secret-app-password",
    "calendarPath": "/dav/calendars/user/tasks/",
    "syncInterval": 60,
    "enableAutoSync": true,
    "excludedFolders": ["Archive/", "Templates/"],
    "excludedTags": ["#private", "#local-only"],
    "completedTaskAgeDays": 30,

    // NEW field
    "enableDebugLogging": false
  },
  "syncState": {
    // Unchanged from 001-caldav-task-sync
    "mappings": { ... }
  }
}
```

### Size Impact
- Additional storage: ~20 bytes for new boolean field
- No impact on existing data structures

---

## iCalendar Property Reference

### Properties Managed by Obsidian

| Property | Purpose | Modification |
|----------|---------|--------------|
| SUMMARY | Task description | Always updated |
| DUE | Due date | Added/updated/removed |
| STATUS | Completion state | Always updated |
| LAST-MODIFIED | Change timestamp | Auto-updated on change |
| DTSTAMP | Creation timestamp | Auto-updated |

### Properties Preserved (Not Modified)

| Property | Purpose | Example |
|----------|---------|---------|
| UID | Unique identifier | `abc123-def456-...` |
| PRODID | Creating application | `-//Nextcloud//Tasks//EN` |
| CATEGORIES | Task categorization | `Work,Important` |
| PRIORITY | Priority level (0-9) | `1` (highest) |
| DESCRIPTION | Extended description | Multi-line text |
| PERCENT-COMPLETE | Completion percentage | `50` |
| RELATED-TO | Task relationships | Parent task UID |
| ATTENDEE | Assigned users | Email addresses |
| ATTACH | Attachments | URLs |
| X-* | Custom properties | Vendor-specific |

---

## Data Flow for Property Preservation

### Update Flow (Obsidian → CalDAV)

```
1. User modifies task in Obsidian
2. Sync engine detects change via content hash
3. Fetch raw VTODO from CalDAV server (preserves all properties)
4. Parse managed properties from Obsidian task
5. Replace ONLY managed properties in raw VTODO string
6. Send modified VTODO back to CalDAV server
7. All extended properties remain intact
```

### Example VTODO Transformation

**Before (on CalDAV server):**
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nextcloud//Tasks//EN
BEGIN:VTODO
UID:task-abc123
SUMMARY:Buy groceries
STATUS:NEEDS-ACTION
DUE;VALUE=DATE:20260115
CATEGORIES:Personal,Shopping
PRIORITY:2
X-NEXTCLOUD-TAGS:grocery
LAST-MODIFIED:20260114T100000Z
DTSTAMP:20260110T080000Z
END:VTODO
END:VCALENDAR
```

**After (Obsidian updates description and status):**
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nextcloud//Tasks//EN
BEGIN:VTODO
UID:task-abc123
SUMMARY:Buy groceries and milk
STATUS:COMPLETED
DUE;VALUE=DATE:20260115
CATEGORIES:Personal,Shopping      ← PRESERVED
PRIORITY:2                        ← PRESERVED
X-NEXTCLOUD-TAGS:grocery          ← PRESERVED
LAST-MODIFIED:20260114T150000Z    ← UPDATED
DTSTAMP:20260114T150000Z          ← UPDATED
END:VTODO
END:VCALENDAR
```

---

## Type Definitions Summary

```typescript
// Extended CalDAVConfiguration
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
  enableDebugLogging: boolean;  // NEW
}

// Default settings update
const DEFAULT_SETTINGS: CalDAVConfiguration = {
  serverUrl: '',
  username: '',
  password: '',
  calendarPath: '',
  syncInterval: 60,
  enableAutoSync: true,
  excludedFolders: [],
  excludedTags: [],
  completedTaskAgeDays: 30,
  enableDebugLogging: false,  // NEW - defaults to false
};
```

---

## Constraints & Invariants

1. **Backward Compatibility:**
   - Missing `enableDebugLogging` field treated as `false`
   - No data migration required for existing installations

2. **Property Preservation:**
   - Extended properties MUST survive round-trip sync
   - Unknown properties MUST be preserved as raw strings
   - Managed properties MUST be correctly replaced (not duplicated)

3. **Logging Behavior:**
   - Debug mode setting takes effect immediately on change
   - INFO-level logs (sync start/finish) always output regardless of debug setting
   - DEBUG-level logs only output when `enableDebugLogging: true`

---

**Data Model Version**: 1.1 (extends 1.0 from 001-caldav-task-sync)
**Compatible with Spec**: [spec.md](./spec.md) (2026-01-14)
**Next Phase**: Contracts & Quickstart

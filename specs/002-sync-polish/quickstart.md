# Quickstart Guide

**Feature**: Sync Polish - Notifications, Logging & Data Preservation
**Date**: 2026-01-14

## Overview

This guide provides instructions for developers implementing the sync polish feature. It covers understanding the existing systems, testing approaches, and implementation guidance.

---

## Prerequisites

### Development Environment

```bash
# Clone repository (if not already done)
git clone <repo-url>
cd obsidian-tasks-caldev

# Switch to feature branch
git checkout 002-sync-polish

# Install dependencies
npm install

# Start development build (watches for changes)
npm run dev
```

### CalDAV Test Server

For testing property preservation, you need a CalDAV server. Options:

1. **Radicale** (easiest local setup):
   ```bash
   pip install radicale
   radicale --storage-filesystem-folder=~/.radicale/collections
   # Available at http://localhost:5232
   ```

2. **Nextcloud** (full-featured):
   - Use existing Nextcloud instance
   - Or Docker: `docker run -p 8080:80 nextcloud`

3. **Baikal** (lightweight):
   - Docker: `docker run -p 80:80 ckulka/baikal`

---

## Understanding Existing Systems

### 1. Notification System (`src/ui/notifications.ts`)

The current notification system provides:

```typescript
// Non-intrusive notice (toast)
showSyncStart(): void

// Success notification
showSyncSuccess(message: string | number): void

// Error handling with modal for auto-sync
showSyncError(error: string, details: string[], app?: App, isAutoSync?: boolean): void
```

**Key insight**: `SyncErrorModal` is already implemented and only shown when `isAutoSync && app` is truthy.

**Changes needed**: Add `isAutoSync` parameter to sync flow to suppress success notifications during automatic sync.

### 2. Logger System (`src/sync/logger.ts`)

The existing logger has:

```typescript
let DEBUG = false;  // Module-level flag

export function setDebugMode(enabled: boolean): void {
  DEBUG = enabled;
}

export class Logger {
  static info(message: string, ...args: unknown[]): void
  static warn(message: string, ...args: unknown[]): void
  static error(message: string, error?: Error | unknown): void
  static debug(message: string, ...args: unknown[]): void  // Only logs if DEBUG=true
}
```

**Key insight**: Debug gating already works. Need to:
1. Add `enableDebugLogging` to settings
2. Wire `setDebugMode()` to settings changes
3. Add dedicated sync start/finish INFO logs

### 3. VTODO Handling (`src/caldav/vtodo.ts`)

Current functions:

```typescript
// Convert Obsidian task to CalDAV format
taskToVTODO(task: Task): { summary, due, status }

// Convert CalDAV task to Obsidian format
vtodoToTask(caldavTask: CalDAVTask): { description, dueDate, status }

// Build complete VTODO string
buildVTODOString(uid, summary, due, status): string

// Parse VTODO string to extract properties
parseVTODOString(vtodoData: string): { uid, summary, due, status, lastModified }
```

**Key insight**: `buildVTODOString()` creates a new VTODO from scratch - this is what loses extended properties. Need to add:
- `updateVTODOProperties()` - modifies existing VTODO string in-place

### 4. CalDAV Client (`src/caldav/client.ts`)

Relevant methods:

```typescript
// Returns raw VTODO data in obj.data
fetchAllTasks(): Promise<CalDAVTask[]>

// Fetch single task (for read-before-update)
fetchTaskByUid(uid: string): Promise<CalDAVTask | null>

// Current update - rebuilds VTODO from scratch (loses properties!)
updateTask(caldavUid, summary, due, status, etag, href): Promise<CalDAVTask>
```

**Key insight**: `fetchCalendarObjects()` returns `{ url, data, etag }` where `data` is the raw iCalendar string. Need to:
- Add `fetchTaskRawData(uid)` to get raw string
- Modify or add update method that uses preservation

---

## Testing the Feature

### Manual Testing - Debug Logging

1. Build and copy to test vault:
   ```bash
   npm run build
   cp main.js manifest.json /path/to/vault/.obsidian/plugins/obsidian-tasks-caldev/
   ```

2. Reload Obsidian (`Ctrl/Cmd + R`)

3. Open Developer Console (`Ctrl/Cmd + Shift + I`)

4. Open plugin settings, toggle "Debug logging"

5. Trigger a sync

6. Verify console output:
   - Debug OFF: Only `[CalDAV Sync] Sync started...` and `[CalDAV Sync] Sync completed...`
   - Debug ON: Additional `[CalDAV Sync DEBUG] ...` messages

### Manual Testing - Notifications

1. Configure automatic sync (default 60s interval)

2. Wait for auto-sync to complete

3. Verify: No modal notification on success

4. Disconnect network or use wrong credentials

5. Wait for auto-sync to fail

6. Verify: Modal notification appears with error

### Manual Testing - Property Preservation

1. Create task in Obsidian: `- [ ] Test task 📅 2026-01-20`

2. Trigger sync to CalDAV

3. Use another CalDAV client (e.g., Nextcloud Tasks, Thunderbird):
   - Open the synced task
   - Add a category (e.g., "Important")
   - Add priority (e.g., High)
   - Save

4. Modify the task in Obsidian (e.g., change description)

5. Trigger sync again

6. Verify in CalDAV client:
   - Description updated
   - Category still present
   - Priority still present

### Unit Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/caldav/vtodo.test.ts
```

Add tests for:
- `updateVTODOProperties()` - property replacement
- Logger debug gating
- Notification behavior (mock Obsidian Notice/Modal)

---

## Implementation Order

Recommended sequence for implementing this feature:

### Step 1: Debug Logging Settings

1. Add `enableDebugLogging` to `types.ts` (CalDAVConfiguration)
2. Add to `settings.ts` (DEFAULT_SETTINGS)
3. Add toggle to `settingsTab.ts`
4. Wire up in `main.ts` (call `setDebugMode` on load and change)
5. Test: Verify toggle works immediately

### Step 2: Minimal Logging

1. Add `Logger.syncStart()` and `Logger.syncComplete()` methods
2. Update `engine.ts` to use these at sync boundaries
3. Audit existing Logger calls - ensure appropriate levels
4. Test: Verify console output matches spec

### Step 3: Notification Updates

1. Add `isAutoSync` parameter to `syncObsidianToCalDAV()`
2. Conditionally call `showSyncStart()` and `showSyncSuccess()`
3. Update `scheduler.ts` to pass `isAutoSync: true`
4. Test: Verify no success notifications during auto-sync

### Step 4: VTODO Property Preservation

1. Add `fetchTaskRawData()` to `client.ts`
2. Add `updateVTODOProperties()` to `vtodo.ts`
3. Add/modify update method to use preservation
4. Update `engine.ts` to use read-before-update pattern
5. Test: Verify extended properties survive round-trip

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `src/types.ts` | Add `enableDebugLogging: boolean` to CalDAVConfiguration |
| `src/settings.ts` | Add `enableDebugLogging: false` to DEFAULT_SETTINGS |
| `src/ui/settingsTab.ts` | Add debug logging toggle |
| `src/main.ts` | Wire `setDebugMode()` to settings |
| `src/sync/logger.ts` | Add `syncStart()` and `syncComplete()` methods |
| `src/sync/engine.ts` | Add `isAutoSync` parameter, use new logger methods |
| `src/caldav/vtodo.ts` | Add `updateVTODOProperties()` function |
| `src/caldav/client.ts` | Add `fetchTaskRawData()`, update preservation method |
| `src/ui/notifications.ts` | No changes needed (current behavior correct) |

---

## Debugging Tips

### VTODO Format Issues

If property preservation doesn't work:

```typescript
// Add debug logging in updateVTODOProperties
Logger.debug('Input VTODO:', existingVTODO);
Logger.debug('Output VTODO:', updatedVTODO);
```

### Console Log Filtering

In browser DevTools, filter console by:
- `[CalDAV Sync]` - all plugin logs
- `[CalDAV Sync DEBUG]` - debug logs only
- `[CalDAV Sync] Sync` - sync lifecycle only

### Network Debugging

Use DevTools Network tab to:
- Inspect VTODO data sent to/from CalDAV server
- Verify extended properties in request/response

---

## Common Pitfalls

1. **Line endings**: iCalendar uses CRLF (`\r\n`). Regex patterns should handle both `\r\n` and `\n`.

2. **Property folding**: Long iCalendar lines may be folded (continuation with space). Handle multi-line properties.

3. **Text escaping**: SUMMARY values may contain escaped characters. Unescape when parsing, escape when writing.

4. **ETag mismatch**: After update, server may return new ETag. Always use fresh ETag for subsequent operations.

5. **Async settings**: When toggling debug mode, ensure `setDebugMode()` is called synchronously with setting change.

---

**Guide Version**: 1.0
**Last Updated**: 2026-01-14

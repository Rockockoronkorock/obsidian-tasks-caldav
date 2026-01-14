# Research & Technical Decisions

**Feature**: Sync Polish - Notifications, Logging & Data Preservation
**Date**: 2026-01-14
**Status**: Complete

## 1. VTODO Property Preservation Strategy

### Decision: **String-based property replacement in existing VTODO data**

### Rationale

The key insight is that **tsdav returns raw VTODO iCalendar strings** via `fetchCalendarObjects()`. The current implementation in `client.ts:parseVTODOToTask()` already works with this raw string data. To preserve extended properties, we should:

1. **Fetch the existing raw VTODO** before updating
2. **Replace only managed properties** (SUMMARY, DUE, STATUS, LAST-MODIFIED) using regex substitution
3. **Preserve everything else** including CATEGORIES, PRIORITY, DESCRIPTION, X-* properties

This approach is conservative and reliable - we treat the iCalendar string as opaque except for the specific properties we manage.

### Implementation Approach

```typescript
// In vtodo.ts - new function
export function updateVTODOProperties(
  existingVTODO: string,
  summary: string,
  due: Date | null,
  status: VTODOStatus
): string {
  let updated = existingVTODO;

  // Replace SUMMARY
  updated = updated.replace(/SUMMARY:[^\r\n]+/, `SUMMARY:${summary}`);

  // Replace or add STATUS
  if (updated.includes('STATUS:')) {
    updated = updated.replace(/STATUS:[^\r\n]+/, `STATUS:${status}`);
  } else {
    // Add STATUS before END:VTODO
    updated = updated.replace('END:VTODO', `STATUS:${status}\nEND:VTODO`);
  }

  // Replace or add/remove DUE
  if (due) {
    const dueString = toCalDAVDate(due);
    if (updated.match(/DUE[;:][\w\W]*?(?=\r?\n)/)) {
      updated = updated.replace(/DUE[;:][\w\W]*?(?=\r?\n)/, `DUE;VALUE=DATE:${dueString}`);
    } else {
      updated = updated.replace('END:VTODO', `DUE;VALUE=DATE:${dueString}\nEND:VTODO`);
    }
  } else {
    // Remove DUE if present but new value is null
    updated = updated.replace(/DUE[;:][^\r\n]+\r?\n/, '');
  }

  // Update LAST-MODIFIED and DTSTAMP
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  updated = updated.replace(/LAST-MODIFIED:[^\r\n]+/, `LAST-MODIFIED:${timestamp}`);
  updated = updated.replace(/DTSTAMP:[^\r\n]+/, `DTSTAMP:${timestamp}`);

  return updated;
}
```

### Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **String replacement** | Simple, reliable, preserves unknowns | Regex can be tricky | ✅ **Selected** |
| **Full iCalendar parser** | Proper parsing | Heavy dependency, complex | ❌ Overkill |
| **Property-by-property rebuild** | Clean structure | Loses unknown properties | ❌ Defeats purpose |

### Implementation Impact

- Add `updateVTODOProperties()` function to `src/caldav/vtodo.ts`
- Modify `CalDAVClient.updateTask()` to accept raw VTODO string
- Add `fetchTaskRawData()` method to CalDAVClient for fetching raw VTODO
- Update `SyncEngine.updateCalDAVTask()` to use read-before-update pattern
- ~100-150 lines of new/modified code

---

## 2. Logger Implementation Pattern

### Decision: **Module-level debug flag with setter function (existing pattern)**

### Rationale

The existing `logger.ts` already implements this exact pattern:

```typescript
let DEBUG = false;

export function setDebugMode(enabled: boolean): void {
  DEBUG = enabled;
}

// In Logger class:
static debug(message: string, ...args: unknown[]): void {
  if (DEBUG) {
    console.log(`[CalDAV Sync DEBUG] ${message}`, ...args);
  }
}
```

This is already the optimal pattern because:
1. **Immediate effect**: Setting `DEBUG = true` takes effect for the very next log call
2. **No restart required**: Module-level variable can be changed at runtime
3. **Simple**: No complex observer or event patterns needed
4. **Standard pattern**: Common in Obsidian plugin ecosystem

### What Needs to Change

The current implementation needs minor adjustments:

1. **Add sync start/finish logging at INFO level**: Currently scattered debug logs; need dedicated "sync started" / "sync completed" INFO logs
2. **Wire debug setting to settings tab**: Add `enableDebugLogging` to CalDAVConfiguration
3. **Call setDebugMode on plugin load and settings change**

### Implementation Approach

```typescript
// In settings.ts - add to DEFAULT_SETTINGS
enableDebugLogging: false

// In main.ts - wire it up
async onload() {
  await this.loadSettings();
  setDebugMode(this.settings.enableDebugLogging);
  // ... rest of onload
}

// In settingsTab.ts - add toggle
new Setting(containerEl)
  .setName('Debug logging')
  .setDesc('Enable detailed debug output in browser console')
  .addToggle(toggle => toggle
    .setValue(this.plugin.settings.enableDebugLogging)
    .onChange(async (value) => {
      this.plugin.settings.enableDebugLogging = value;
      setDebugMode(value);
      await this.plugin.saveSettings();
    }));
```

### Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Module-level flag (current)** | Simple, instant effect, no deps | Global state | ✅ **Selected** |
| **Logger instance with config** | More OOP | Requires passing around | ❌ Over-engineered |
| **Event-based toggle** | Decoupled | Complexity | ❌ Unnecessary |

### Implementation Impact

- Add `enableDebugLogging: boolean` to CalDAVConfiguration type
- Add to DEFAULT_SETTINGS (default: `false`)
- Add toggle to settings tab
- Wire up in main.ts onload
- Add dedicated `Logger.syncStart()` and `Logger.syncComplete()` methods for INFO-level sync lifecycle logs
- ~30-50 lines of new code

---

## 3. tsdav VTODO Retrieval

### Decision: **tsdav provides raw VTODO string via data property - use existing pattern**

### Rationale

Analysis of existing code (`client.ts`) confirms that **tsdav already returns raw VTODO data**:

```typescript
// From client.ts:fetchCalendarObjects
const calendarObjects = await this.client.fetchCalendarObjects({
  calendar: this.calendar,
  filters: vtodoFilter,
});

// Each object has: { url: string; data: string; etag?: string }
// obj.data IS the raw VTODO iCalendar string
```

The `data` property contains the complete raw iCalendar string including all properties:

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
BEGIN:VTODO
UID:abc123
SUMMARY:My Task
STATUS:NEEDS-ACTION
CATEGORIES:Work,Important
PRIORITY:1
X-CUSTOM:some-value
END:VTODO
END:VCALENDAR
```

This means we can:
1. Fetch the raw VTODO before updating using existing `fetchTaskByUid()` method
2. Get the raw `data` string from the calendar object
3. Modify only the managed properties
4. Send the modified string back for update

### Implementation Approach

```typescript
// Add method to CalDAVClient
async fetchTaskRawData(uid: string): Promise<string | null> {
  // Similar to fetchTaskByUid but returns obj.data instead of parsed task
  const calendarObjects = await this.client.fetchCalendarObjects({...});
  for (const obj of calendarObjects) {
    if (obj.data && obj.data.includes(`UID:${uid}`)) {
      return obj.data;
    }
  }
  return null;
}
```

### Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Use obj.data directly** | Already available, no new requests | Need to find task first | ✅ **Selected** |
| **Custom PROPFIND** | More control | Complex, unnecessary | ❌ Over-engineered |
| **Separate library for iCal** | Full parsing | Large dependency | ❌ Overkill |

### Implementation Impact

- Add `fetchTaskRawData()` to CalDAVClient
- Modify `updateTask()` to optionally accept existing raw data
- ~40-60 lines of new code

---

## 4. Notification Behavior Analysis

### Decision: **Update existing notification functions - remove success modals**

### Rationale

Analysis of existing `notifications.ts` shows:

```typescript
export function showSyncStart(): void {
  new Notice('Syncing tasks...', 2000);  // ✅ Non-modal, OK
}

export function showSyncSuccess(message: string | number): void {
  new Notice(`✓ ${message}`);  // ✅ Non-modal, OK - but called for every sync
}

export function showSyncError(error: string, details: string[], app?: App, isAutoSync: boolean = false): void {
  if (isAutoSync && app) {
    new SyncErrorModal(app, error, details).open();  // ✅ Modal for auto-sync errors
  } else {
    new Notice(errorMsg, 8000);  // ✅ Non-modal for manual sync errors
  }
}
```

Current behavior analysis:
- `showSyncStart()` - Non-intrusive notice (OK)
- `showSyncSuccess()` - Non-intrusive notice (OK as-is, but frequency may be issue)
- `showSyncError()` - Already shows modal only for auto-sync errors (correct)

The open point says "modal notifications only if there is an error". The current code already does this correctly for errors. The issue may be:
1. Success notifications are shown for every auto-sync (potentially annoying)
2. Filter stats notifications (`new Notice(...)` in engine.ts) may be too frequent

### Implementation Approach

For automatic sync, minimize notifications:
- Keep `showSyncStart()` for manual sync only
- Keep `showSyncSuccess()` for manual sync only
- Keep modal errors for automatic sync

```typescript
// In engine.ts - modify sync method signature
async syncObsidianToCalDAV(isAutoSync: boolean = false): Promise<void> {
  if (!isAutoSync) {
    showSyncStart();
  }
  // ... sync logic ...
  if (!isAutoSync) {
    showSyncSuccess(...);
  }
}
```

### Implementation Impact

- Add `isAutoSync` parameter to sync methods
- Conditionally show notifications based on sync type
- Remove inline `new Notice()` calls for filter stats during auto-sync
- ~20-30 lines of changes

---

## Summary

| Decision Area | Choice | Impact |
|---------------|--------|--------|
| **VTODO Preservation** | String replacement | ~100-150 lines, property-level updates |
| **Debug Logging** | Existing pattern + settings wire-up | ~30-50 lines |
| **tsdav Raw Data** | Use obj.data (already available) | ~40-60 lines |
| **Notifications** | Conditional based on isAutoSync | ~20-30 lines |

**Total Estimated Changes**: ~200-290 lines across 5-8 files

**Dependencies**: None new - all patterns already exist in codebase

**Risk Level**: Low - extending existing patterns, not introducing new ones

---

**Research Status**: ✅ Complete - All technical questions resolved
**Ready for Phase 1**: Design & Contracts

# Quickstart: Implementing Obsidian Link Sync

**Feature**: 003-obsidian-link-sync | **Branch**: `003-obsidian-link-sync`

## Overview

This guide walks through implementing the Obsidian Link Sync feature in ~4 hours of focused development. The implementation adds Obsidian URIs to CalDAV task descriptions, enabling users to jump directly from calendar apps to the source Obsidian note.

**Complexity**: Low (isolated feature, minimal code changes)
**Estimated Time**: 3-4 hours
**Prerequisites**: TypeScript, basic Obsidian API knowledge, CalDAV test server

---

## Architecture Summary

```
Obsidian Task → URI Builder → Sync Engine → CalDAV Client → CalDAV Server
     ↓              ↓              ↓              ↓              ↓
  blockId      Generate URI   Call builder   Add to VTODO   Store with URI
  filePath                    Try-catch       (DESCRIPTION)
  (existing)                  error handle
```

**Key Insight**: The existing property preservation pattern automatically maintains DESCRIPTION fields across updates, so we only need to set it once during task creation.

---

## Implementation Steps

### Step 1: Create URI Builder Module (45 min)

**File**: `src/obsidian/uriBuilder.ts` (new file)

**Purpose**: Pure functions for generating Obsidian URIs and formatting DESCRIPTION content.

**Implementation**:

```typescript
/**
 * URI Builder Service
 * Generates Obsidian deep links from task metadata.
 */

// Regular expression for validating block ID format: task-{uuid}
const BLOCK_ID_REGEX = /^task-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Validates that a block ID matches the expected UUID format.
 */
export function isValidBlockId(blockId: string): boolean {
  return BLOCK_ID_REGEX.test(blockId);
}

/**
 * Builds a fully formatted Obsidian URI for opening a specific task.
 *
 * @throws Error if inputs are invalid
 */
export function buildObsidianURI(
  vaultName: string,
  filePath: string,
  blockId: string
): string {
  // Validate inputs
  if (!vaultName || vaultName.trim() === '') {
    throw new Error('Vault name is required');
  }
  if (!filePath || filePath.trim() === '') {
    throw new Error('File path is required');
  }
  if (!blockId || !isValidBlockId(blockId)) {
    throw new Error('Invalid block ID format');
  }

  // URL-encode components (blockId doesn't need encoding - UUID-safe)
  const encodedVault = encodeURIComponent(vaultName);
  const encodedFile = encodeURIComponent(filePath);

  // Construct URI
  return `obsidian://open?vault=${encodedVault}&file=${encodedFile}&block=${blockId}`;
}

/**
 * Builds the DESCRIPTION field content with Obsidian URI appended.
 */
export function buildDescriptionWithURI(
  uri: string,
  existingContent?: string
): string {
  // For initial implementation, assume no existing content
  // Future enhancement: preserve existing content if present
  return `\n\nObsidian Link: ${uri}`;
}
```

**Testing** (manual):
- Call `buildObsidianURI("My Vault", "Projects/tasks.md", "task-abc...")` in Node/browser console
- Verify output format
- Test with spaces, special chars, Unicode

**Time**: ~45 minutes (implementation + manual testing)

---

### Step 2: Integrate into Sync Engine (60 min)

**File**: `src/sync/engine.ts` (modify existing)

**Changes**:
1. Import URI builder functions
2. Modify `createTaskOnCalDAV()` to generate URIs
3. Wrap URI generation in try-catch for graceful degradation

**Implementation**:

```typescript
// Add import at top of file
import { buildObsidianURI, buildDescriptionWithURI } from '../obsidian/uriBuilder';

// Locate the existing createTaskOnCalDAV method (around line 511-540)
// Modify as follows:

private async createTaskOnCalDAV(task: Task): Promise<void> {
  // Existing VTODO conversion (unchanged)
  const vtodoData = taskToVTODO(task);

  // NEW: Generate Obsidian URI with error handling
  let description: string | undefined;
  try {
    // Get vault name from Obsidian API
    const vaultName = this.vault.getName();

    // Validate block ID before attempting URI generation
    if (!task.blockId) {
      console.warn('Skipping URI generation: task missing block ID');
    } else {
      // Generate URI and format DESCRIPTION
      const uri = buildObsidianURI(vaultName, task.filePath, task.blockId);
      description = buildDescriptionWithURI(uri);
    }
  } catch (error) {
    // Log warning but continue task creation (graceful degradation)
    console.warn(`Failed to generate Obsidian URI for task: ${error.message}`);
  }

  // Call CalDAV client with optional description (MODIFIED: added parameter)
  await this.caldavClient.createTask(vtodoData, description);

  // Existing mapping storage (unchanged)
  // ... rest of method
}
```

**Verification**:
- TypeScript compilation should succeed
- No breaking changes to other methods
- `updateCalDAVTask()` remains unchanged (property preservation handles DESCRIPTION)

**Time**: ~60 minutes (code changes + verification + testing edge cases)

---

### Step 3: Update CalDAV Client (45 min)

**File**: `src/caldav/client.ts` (modify existing)

**Changes**:
1. Add optional `description` parameter to `createTask()`
2. Pass description to VTODO construction
3. Include DESCRIPTION field in VTODO string

**Implementation**:

```typescript
// Locate the existing createTask method (around line 374-435)
// Modify signature and implementation:

async createTask(
  vtodoData: string,
  description?: string  // NEW: optional parameter
): Promise<{ uid: string; href: string; etag: string }> {
  // ... existing logic to generate UID, href, timestamp ...

  // Build VTODO string
  let vtodo = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Obsidian Tasks CalDAV Plugin//EN\n`;
  vtodo += `BEGIN:VTODO\n`;
  vtodo += `UID:${uid}\n`;
  vtodo += `DTSTAMP:${timestamp}\n`;
  vtodo += `SUMMARY:${escapedSummary}\n`;  // Existing

  // NEW: Add DESCRIPTION field if provided
  if (description) {
    // Import escapeText from vtodo.ts if not already imported
    const escapedDesc = escapeText(description);
    vtodo += `DESCRIPTION:${escapedDesc}\n`;
  }

  vtodo += `STATUS:${status}\n`;
  if (dueDate) {
    vtodo += `DUE;VALUE=DATE:${dueDate}\n`;
  }
  vtodo += `LAST-MODIFIED:${timestamp}\n`;
  vtodo += `END:VTODO\n`;
  vtodo += `END:VCALENDAR\n`;

  // ... existing logic to send to server ...
}
```

**Note**: Verify that `escapeText()` is imported from `src/caldav/vtodo.ts`. If not, add:
```typescript
import { escapeText } from './vtodo';
```

**Verification**:
- TypeScript compilation should succeed
- Calls to `createTask()` without description still work (backward compatible)
- VTODO format is valid (newlines, field order)

**Time**: ~45 minutes (code changes + verification)

---

### Step 4: Verify Property Preservation (15 min)

**File**: `src/caldav/vtodo.ts` (READ ONLY - no changes needed)

**Goal**: Confirm that `updateVTODOProperties()` already preserves DESCRIPTION field.

**Verification Steps**:
1. Read the `updateVTODOProperties()` function (around line 187-274)
2. Confirm it only updates: SUMMARY, STATUS, DUE, LAST-MODIFIED, DTSTAMP
3. Confirm all other fields (including DESCRIPTION) are preserved
4. No modifications needed ✓

**Expected Behavior**:
- When `updateCalDAVTask()` is called, it fetches the existing VTODO
- Only managed fields are updated
- DESCRIPTION remains unchanged
- This is the existing pattern - no code changes required

**Time**: ~15 minutes (code review + documentation)

---

### Step 5: Manual Testing (60 min)

**Setup**:
1. Configure CalDAV test server (Nextcloud, Radicale, or iCloud)
2. Create a dev vault with test tasks
3. Enable plugin hot-reload (`npm run dev`)

**Test Scenarios**:

#### Test 1: Basic URI Generation (15 min)
1. Create a task in Obsidian: `- [ ] Test task 📅 2026-01-30`
2. Trigger sync (via command or auto-sync)
3. Verify in CalDAV client (Apple Calendar, Thunderbird):
   - Task appears with correct summary and due date
   - DESCRIPTION field contains `Obsidian Link: obsidian://...`
   - URI is clickable

#### Test 2: URI Opens Correct Note (10 min)
1. In CalDAV client, open task details
2. Click the Obsidian URI
3. Verify:
   - Obsidian launches
   - Correct vault opens
   - Note opens to the task location (block reference)

#### Test 3: Property Preservation (15 min)
1. Create and sync a task (with URI)
2. Update the task in Obsidian (change status to completed)
3. Trigger sync
4. Verify in CalDAV client:
   - Task status updated to completed ✓
   - DESCRIPTION with URI unchanged ✓

#### Test 4: Edge Cases (20 min)
1. **Vault with spaces**: Vault name = "My Work Vault"
   - Verify URI encodes spaces as `%20`
2. **File path with special chars**: `Projects & Tasks (2024).md`
   - Verify URI encodes `&` as `%26`, spaces as `%20`
3. **Unicode characters**: File name with emojis or non-ASCII
   - Verify URI encodes correctly
4. **Missing block ID**: Task without block ID (edge case)
   - Verify sync succeeds WITHOUT URI, warning logged

**Time**: ~60 minutes (setup + testing scenarios)

---

### Step 6: Cross-Platform Validation (Optional, 30 min)

**Goal**: Verify URIs work on different platforms.

**Test Matrix**:
| Platform | CalDAV Client | Expected Behavior |
|----------|---------------|-------------------|
| macOS | Apple Calendar | URI clickable, opens Obsidian Desktop |
| iOS | Reminders.app | URI clickable, opens Obsidian Mobile |
| Windows | Thunderbird | URI clickable, opens Obsidian Desktop |
| Android | Google Tasks | URI clickable, opens Obsidian Mobile |
| Linux | Thunderbird | URI clickable, opens Obsidian Desktop |

**Note**: Full cross-platform testing is thorough but time-consuming. Prioritize macOS/iOS if time-constrained.

**Time**: ~30 minutes (per platform)

---

## Troubleshooting

### Issue: URI Not Appearing in CalDAV Client

**Possible Causes**:
1. Block ID missing or invalid → Check console for warnings
2. `description` parameter not passed to `createTask()` → Verify integration in sync engine
3. CalDAV client doesn't display DESCRIPTION → Try different client (Thunderbird, Apple Calendar)

**Debug**:
- Add `console.log(description)` in `createTaskOnCalDAV()` before calling client
- Verify VTODO format using CalDAV server raw data (WebDAV interface)

---

### Issue: URI Opens Wrong Note

**Possible Causes**:
1. File path encoding incorrect → Verify `encodeURIComponent()` usage
2. Block ID doesn't match → Verify block ID extraction from task line

**Debug**:
- Copy URI from CalDAV client, paste in browser → Should open Obsidian
- Manually construct URI with correct values, compare to generated URI

---

### Issue: Property Preservation Not Working

**Possible Causes**:
1. `updateVTODOProperties()` modified incorrectly → Revert changes to vtodo.ts (no changes needed)
2. CalDAV server doesn't return full VTODO → Check server compatibility

**Debug**:
- Add logging in `updateTaskWithPreservation()` to print fetched VTODO
- Verify DESCRIPTION present in fetched data

---

### Issue: TypeScript Compilation Errors

**Common Errors**:
1. `Cannot find module '../obsidian/uriBuilder'` → Verify file path and export syntax
2. `Parameter 'description' implicitly has 'any' type` → Add type annotation: `description?: string`
3. `Property 'getName' does not exist on type 'Vault'` → Verify Obsidian API version (should be available)

---

## Performance Validation

**Expected Overhead**:
- URI generation: <5ms per task
- 100 tasks synced: <500ms total overhead
- No additional network requests
- No additional disk I/O

**Profiling** (optional):
```typescript
// Add timing to createTaskOnCalDAV
const startTime = performance.now();
// ... URI generation code ...
const endTime = performance.now();
console.log(`URI generation took ${endTime - startTime}ms`);
```

**Acceptable Performance**: <5ms per task on modern hardware.

---

## Definition of Done

- [x] **Code Complete**:
  - [x] `uriBuilder.ts` created with URI generation logic
  - [x] `engine.ts` modified to call URI builder during task creation
  - [x] `client.ts` modified to accept optional description parameter
  - [x] No changes to `vtodo.ts` (property preservation already works)

- [x] **Testing Complete**:
  - [x] Basic URI generation works (task synced with URI in DESCRIPTION)
  - [x] URI opens correct note in Obsidian
  - [x] Property preservation works (DESCRIPTION unchanged on updates)
  - [x] Edge cases handled (spaces, special chars, missing block ID)

- [x] **Documentation Updated**:
  - [x] Code comments added to new/modified functions
  - [x] Quickstart guide completed (this file)
  - [x] Known limitations documented (if any)

- [x] **Quality Checks**:
  - [x] TypeScript compilation succeeds (`npm run build`)
  - [x] Linting passes (`npm run lint`)
  - [x] No console errors during sync
  - [x] Backward compatibility verified (existing tasks sync without issues)

---

## Next Steps

After implementing and testing this feature:

1. **User Documentation**: Update README.md with:
   - Feature description
   - Usage instructions
   - Supported CalDAV clients
   - Known limitations (URIs don't update if files move)

2. **Optional Enhancements** (future):
   - Settings toggle to enable/disable URI syncing
   - Bulk URI generation for existing tasks
   - Visual indicator in Obsidian showing CalDAV sync status
   - URI validation (pre-flight check that note exists)

3. **Release Preparation**:
   - Update `manifest.json` version (e.g., 0.2.0)
   - Write release notes highlighting new feature
   - Tag release and attach build artifacts

---

## Reference Links

- **Obsidian URI Scheme**: Community documentation on `obsidian://` protocol
- **RFC 5545 (iCalendar)**: VTODO specification and TEXT value escaping
- **CalDAV Specification**: RFC 4791
- **Existing Codebase Patterns**:
  - Property preservation: `src/caldav/vtodo.ts:187-274`
  - Task creation: `src/sync/engine.ts:511-540`
  - VTODO construction: `src/caldav/client.ts:374-435`

---

## Time Breakdown Summary

| Step | Task | Time |
|------|------|------|
| 1 | Create URI Builder | 45 min |
| 2 | Integrate into Sync Engine | 60 min |
| 3 | Update CalDAV Client | 45 min |
| 4 | Verify Property Preservation | 15 min |
| 5 | Manual Testing | 60 min |
| 6 | Cross-Platform Validation (optional) | 30 min |
| **Total** | | **3h 45m - 4h 15m** |

**Fast-Track** (skip cross-platform): ~3h 45m
**Thorough** (full validation): ~4h 15m

---

## FAQ

**Q: Why not update URIs when files move?**
A: Per spec, URIs are set once during creation. Updating URIs would require tracking file renames/moves, which is complex and out of scope for v1. Users are responsible for file organization after initial sync.

**Q: What if the CalDAV server doesn't support DESCRIPTION?**
A: DESCRIPTION is a standard RFC 5545 field. All modern CalDAV servers support it. If a server rejects DESCRIPTION, task creation will fail (rare, report as bug).

**Q: Can I disable URI syncing?**
A: Not in v1. Future enhancement: Add settings toggle.

**Q: What if vault name changes?**
A: Existing URIs on CalDAV will have stale vault names. URIs are not updated. Users must manually recreate tasks if vault is renamed.

**Q: Does this work with bidirectional sync?**
A: Yes, but URIs only flow Obsidian→CalDAV. CalDAV→Obsidian sync ignores DESCRIPTION field entirely.

---

## Support

If you encounter issues during implementation:
1. Check console logs for warnings/errors
2. Verify CalDAV server compatibility (test with Nextcloud or Radicale)
3. Review contracts in `contracts/` directory for detailed specifications
4. Refer to research.md for technical decisions and rationale

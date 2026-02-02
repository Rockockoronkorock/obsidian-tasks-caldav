# Quickstart Guide: Due Date Filter Implementation

**Feature**: 004-sync-due-date-only
**Date**: 2026-02-02
**For**: Developers implementing this feature

---

## Overview

This guide provides a step-by-step implementation path for adding the due date filter feature to the CalDAV Task Sync plugin. Total implementation time: ~2-3 hours including tests.

---

## Prerequisites

- Development environment set up (see main README.md)
- TypeScript 5.8.3 installed
- Obsidian test vault available
- Familiarity with existing codebase (see research.md for architecture overview)

---

## Implementation Steps

### Step 1: Add Configuration Field (15 minutes)

**File**: `src/types.ts`

**Action**: Add new field to `CalDAVConfiguration` interface

```typescript
export interface CalDAVConfiguration {
  // ... existing fields ...
  enableDebugLogging: boolean;

  // NEW FIELD (add at end to group with other filter settings)
  syncOnlyTasksWithDueDate: boolean;
}
```

**File**: `src/settings.ts`

**Action**: Add default value to `DEFAULT_SETTINGS`

```typescript
export const DEFAULT_SETTINGS: CalDAVConfiguration = {
  // ... existing defaults ...
  enableDebugLogging: false,

  // NEW DEFAULT (false = backward compatible)
  syncOnlyTasksWithDueDate: false,
};
```

**Verify**:
- TypeScript compiles without errors
- No type mismatches

---

### Step 2: Add Filter Logic (30 minutes)

**File**: `src/sync/filters.ts`

**Action 1**: Add helper function to check for sync mapping

```typescript
/**
 * Determines if a task has been previously synced to CalDAV.
 *
 * @param task - The task to check
 * @param mappings - Map of existing sync mappings (blockId -> SyncMapping)
 * @returns true if task was previously synced, false otherwise
 */
function hasSyncMapping(
  task: Task,
  mappings: Map<string, SyncMapping>
): boolean {
  if (!task.blockId) return false;
  return mappings.has(task.blockId);
}
```

**Action 2**: Update `shouldSync` function signature

```typescript
// OLD signature (2 parameters)
export function shouldSync(task: Task, config: CalDAVConfiguration): boolean

// NEW signature (3 parameters - add mappings)
export function shouldSync(
  task: Task,
  config: CalDAVConfiguration,
  mappings: Map<string, SyncMapping>
): boolean
```

**Action 3**: Add due date filter logic at the START of `shouldSync` function

```typescript
export function shouldSync(
  task: Task,
  config: CalDAVConfiguration,
  mappings: Map<string, SyncMapping>
): boolean {
  // NEW: Due date filter (if enabled)
  if (config.syncOnlyTasksWithDueDate) {
    // If task has no due date AND was never synced → skip
    if (!task.dueDate && !hasSyncMapping(task, mappings)) {
      return false;
    }
    // else: either has due date OR was previously synced → continue to other filters
  }

  // EXISTING filters below (unchanged)
  if (matchesFolderExclusion(task.filePath, config.excludedFolders)) {
    return false;
  }

  if (hasExcludedTag(task.tags, config.excludedTags)) {
    return false;
  }

  if (isCompletedTooOld(task, config.completedTaskAgeDays)) {
    return false;
  }

  return true;
}
```

**Verify**:
- TypeScript compiles
- Logic is clear and follows existing pattern

---

### Step 3: Update Filter Call Sites (15 minutes)

**File**: `src/sync/engine.ts`

**Action**: Update all calls to `shouldSync()` to pass the `mappings` parameter

**Find calls like this**:
```typescript
if (!shouldSync(task, this.config)) {
  continue; // Skip this task
}
```

**Change to**:
```typescript
if (!shouldSync(task, this.config, this.mappings)) {
  continue; // Skip this task
}
```

**Expected locations**:
- Main sync loop in `syncObsidianToCalDAV()`
- Any other places that call the filter function

**Verify**:
- All TypeScript errors resolved
- `npm run build` succeeds

---

### Step 4: Add Settings UI (20 minutes)

**File**: `src/ui/settingsTab.ts`

**Action**: Add checkbox setting to the settings tab

**Location**: Find where other sync settings are added (likely after "Enable auto-sync")

**Code to add**:
```typescript
new Setting(containerEl)
  .setName('Sync only tasks with due dates')
  .setDesc(
    'When enabled, only tasks with due dates will be synced. ' +
    'Previously synced tasks will continue to sync even if their due date is removed.'
  )
  .addToggle(toggle => toggle
    .setValue(this.plugin.settings.syncOnlyTasksWithDueDate)
    .onChange(async (value) => {
      this.plugin.settings.syncOnlyTasksWithDueDate = value;
      await this.plugin.saveSettings();
    }));
```

**Verify**:
- Setting appears in plugin settings UI
- Checkbox reflects current value
- Toggling checkbox updates value
- Setting persists after Obsidian reload

---

### Step 5: Write Unit Tests (45 minutes)

**File**: `tests/unit/filters.test.ts` (NEW FILE)

**Action**: Create comprehensive test suite

```typescript
import { shouldSync } from '../../src/sync/filters';
import { Task, CalDAVConfiguration, SyncMapping } from '../../src/types';

describe('Due Date Filter', () => {
  const baseConfig: CalDAVConfiguration = {
    // ... minimal config for testing
    syncOnlyTasksWithDueDate: false,
    excludedFolders: [],
    excludedTags: [],
    completedTaskAgeDays: 30,
  };

  const baseTask: Task = {
    blockId: '',
    filePath: 'test.md',
    lineNumber: 1,
    description: 'Test task',
    dueDate: null,
    status: 'open',
    rawLine: '- [ ] Test task',
    tags: [],
    completionDate: null,
  };

  const emptyMappings = new Map<string, SyncMapping>();

  describe('when filter is disabled', () => {
    it('should sync tasks with due dates', () => {
      const task = { ...baseTask, dueDate: new Date('2025-02-15') };
      const config = { ...baseConfig, syncOnlyTasksWithDueDate: false };

      expect(shouldSync(task, config, emptyMappings)).toBe(true);
    });

    it('should sync tasks without due dates', () => {
      const task = { ...baseTask, dueDate: null };
      const config = { ...baseConfig, syncOnlyTasksWithDueDate: false };

      expect(shouldSync(task, config, emptyMappings)).toBe(true);
    });
  });

  describe('when filter is enabled', () => {
    it('should sync tasks with due dates', () => {
      const task = { ...baseTask, dueDate: new Date('2025-02-15') };
      const config = { ...baseConfig, syncOnlyTasksWithDueDate: true };

      expect(shouldSync(task, config, emptyMappings)).toBe(true);
    });

    it('should NOT sync tasks without due dates (not previously synced)', () => {
      const task = { ...baseTask, dueDate: null, blockId: '' };
      const config = { ...baseConfig, syncOnlyTasksWithDueDate: true };

      expect(shouldSync(task, config, emptyMappings)).toBe(false);
    });

    it('should sync tasks without due dates (previously synced)', () => {
      const blockId = 'task-abc123';
      const task = { ...baseTask, dueDate: null, blockId };
      const config = { ...baseConfig, syncOnlyTasksWithDueDate: true };

      const mappings = new Map<string, SyncMapping>([
        [blockId, { blockId, caldavUid: 'uid-123' } as SyncMapping]
      ]);

      expect(shouldSync(task, config, mappings)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty blockId as not synced', () => {
      const task = { ...baseTask, dueDate: null, blockId: '' };
      const config = { ...baseConfig, syncOnlyTasksWithDueDate: true };

      const mappings = new Map<string, SyncMapping>([
        ['task-xyz', { blockId: 'task-xyz' } as SyncMapping]
      ]);

      expect(shouldSync(task, config, mappings)).toBe(false);
    });

    it('should work with other filters (folder exclusion)', () => {
      const task = {
        ...baseTask,
        dueDate: new Date('2025-02-15'),
        filePath: 'Archive/test.md'
      };
      const config = {
        ...baseConfig,
        syncOnlyTasksWithDueDate: true,
        excludedFolders: ['Archive']
      };

      expect(shouldSync(task, config, emptyMappings)).toBe(false);
    });
  });
});
```

**Verify**:
- Run: `npm test -- filters.test.ts`
- All tests pass

---

### Step 6: Write Integration Tests (30 minutes)

**File**: `tests/integration/sync.test.ts` (UPDATE EXISTING)

**Action**: Add end-to-end test scenarios

```typescript
describe('Due Date Filter Integration', () => {
  it('should continue syncing task after due date removal', async () => {
    // 1. Setup: Create task with due date
    // 2. Enable filter, run sync → task syncs
    // 3. Remove due date from task
    // 4. Run sync again → task still syncs (has mapping)
    // 5. Verify: CalDAV entry is updated
  });

  it('should not sync new tasks without due dates when filter enabled', async () => {
    // 1. Enable filter
    // 2. Create task without due date
    // 3. Run sync
    // 4. Verify: Task NOT present on CalDAV
  });

  it('should persist filter setting across restarts', async () => {
    // 1. Enable filter
    // 2. Reload plugin
    // 3. Verify: Setting is still enabled
  });
});
```

**Verify**:
- Run: `npm test`
- All integration tests pass

---

### Step 7: Manual Testing (30 minutes)

**Setup Test Vault**:

1. Install plugin in Obsidian test vault
2. Configure CalDAV connection
3. Create test tasks:
   ```markdown
   - [ ] Task A with due date 📅 2025-02-20
   - [ ] Task B without due date
   ```

**Test Scenarios**:

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Default behavior (filter OFF) | Create tasks A & B, sync | Both tasks sync to CalDAV |
| Enable filter | Toggle setting ON, sync | Only Task A syncs |
| Remove due date from synced task | Remove 📅 from Task A, sync | Task A still syncs (has mapping) |
| Add new task without date | Create Task C (no date), sync | Task C does NOT sync |
| Disable filter | Toggle setting OFF, sync | Task C now syncs |
| Settings persistence | Toggle ON, reload Obsidian | Setting remains ON |

**Verify**:
- All scenarios pass
- No errors in console
- Settings UI works correctly

---

## Common Issues & Solutions

### Issue 1: TypeScript Error - "Property 'syncOnlyTasksWithDueDate' does not exist"

**Cause**: Settings type not updated or settings not loaded

**Solution**:
1. Verify `types.ts` has the field
2. Verify `settings.ts` has the default
3. Run `npm run build` to rebuild
4. Reload Obsidian (Settings may be cached)

---

### Issue 2: Filter Not Applying

**Cause**: Filter logic not executed or wrong parameter passed

**Solution**:
1. Add debug logging: `console.log('Filter enabled:', config.syncOnlyTasksWithDueDate)`
2. Verify `shouldSync()` is called with 3 parameters
3. Check that mappings are populated (not empty Map)

---

### Issue 3: Previously Synced Tasks Not Syncing

**Cause**: Mapping not found or blockId mismatch

**Solution**:
1. Verify blockId is present in task: `console.log('BlockId:', task.blockId)`
2. Verify mapping exists: `console.log('Has mapping:', mappings.has(task.blockId))`
3. Check data.json for mappings array

---

### Issue 4: Settings Not Persisting

**Cause**: `saveSettings()` not called or data.json not writable

**Solution**:
1. Verify `onChange` handler calls `await this.plugin.saveSettings()`
2. Check file permissions on `data.json`
3. Look for errors in Obsidian console

---

## Testing Checklist

Before marking implementation complete, verify:

- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] Linter passes (`npm run lint`)
- [ ] All unit tests pass (`npm test`)
- [ ] All integration tests pass
- [ ] Manual test scenarios pass (all 6 scenarios above)
- [ ] Settings UI displays correctly
- [ ] Settings persist across Obsidian reload
- [ ] Backward compatibility: Plugin works with old data.json files
- [ ] No console errors during normal operation
- [ ] Mobile testing (if not `isDesktopOnly: true`)

---

## Code Review Checklist

When submitting for review:

- [ ] All files follow existing code style
- [ ] TypeScript strict mode compliance (no `any` types)
- [ ] Functions have clear, single responsibilities
- [ ] Variable names are descriptive
- [ ] Comments explain "why", not "what"
- [ ] No hardcoded values (use constants)
- [ ] Error handling is fail-safe
- [ ] Test coverage is comprehensive
- [ ] Documentation is updated (if needed)
- [ ] Constitution compliance verified (all 5 principles)

---

## Files Modified Summary

| File | Changes | Lines Changed |
|------|---------|---------------|
| `src/types.ts` | Add field to interface | +1 |
| `src/settings.ts` | Add default value | +1 |
| `src/sync/filters.ts` | Add filter logic + helper | +15-20 |
| `src/sync/engine.ts` | Update function calls | +1-2 |
| `src/ui/settingsTab.ts` | Add checkbox setting | +8-10 |
| `tests/unit/filters.test.ts` | New test file | +100-150 |
| `tests/integration/sync.test.ts` | Add integration tests | +50-80 |

**Total**: ~180-270 lines of code (including tests)

---

## Next Steps After Implementation

1. Run `/speckit.tasks` to generate task breakdown for execution
2. Create feature branch: `git checkout 004-sync-due-date-only`
3. Implement following this guide
4. Submit PR with test results
5. Update CLAUDE.md with new technology (if any)
6. Release with version bump and changelog

---

## Resources

- **Feature Spec**: `specs/004-sync-due-date-only/spec.md`
- **Research**: `specs/004-sync-due-date-only/research.md`
- **Data Model**: `specs/004-sync-due-date-only/data-model.md`
- **API Contract**: `specs/004-sync-due-date-only/contracts/filter-api.ts`
- **Constitution**: `.specify/memory/constitution.md`

---

**Quickstart Status**: ✅ Complete
**Estimated Implementation Time**: 2-3 hours
**Complexity**: Low (focused enhancement to existing system)

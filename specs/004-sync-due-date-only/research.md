# Research: Due Date Filter for Task Synchronization

**Feature**: 004-sync-due-date-only
**Date**: 2026-02-02
**Status**: Complete

## Overview

This document captures the technical research and decision-making process for implementing a due date filter in the CalDAV task synchronization system. All technical unknowns have been resolved through codebase exploration.

---

## Research Questions & Findings

### 1. How are tasks currently filtered before sync?

**Finding**: The plugin has an existing, mature filtering system in `src/sync/filters.ts`:

**Current Filter Criteria**:
1. **Folder Exclusion** (`excludedFolders`): Skips tasks in specified vault folders
2. **Tag Exclusion** (`excludedTags`): Skips tasks with specified inline tags
3. **Age Threshold** (`completedTaskAgeDays`): Skips completed tasks older than N days

**Filter Architecture**:
```typescript
// src/sync/filters.ts
export function shouldSync(task: Task, config: CalDAVConfiguration): boolean {
  if (matchesFolderExclusion(task.filePath, config.excludedFolders)) return false;
  if (hasExcludedTag(task.tags, config.excludedTags)) return false;
  if (isCompletedTooOld(task, config.completedTaskAgeDays)) return false;
  return true;
}
```

**Decision**: Add the due date filter as a fourth criterion in this existing function, maintaining consistency with current patterns.

**Rationale**:
- Proven pattern already in production
- Minimal code changes
- Easy to test and understand
- Maintains single responsibility (filters.ts handles all sync filtering)

---

### 2. How are due dates detected and parsed?

**Finding**: The plugin uses `src/vault/taskParser.ts` with the `parseTasksPluginDate()` function:

**Date Format**: `📅 YYYY-MM-DD` (Obsidian Tasks plugin standard)

**Parsing Implementation**:
```typescript
// src/vault/taskParser.ts
export function parseTasksPluginDate(line: string): Date | null {
  const match = line.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;

  const [year, month, day] = match[1].split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
```

**Task Object Structure**:
```typescript
interface Task {
  dueDate: Date | null;  // Null if no due date present
  // ... other fields
}
```

**Decision**: Use the existing `task.dueDate` field (already populated by scanner) rather than re-parsing.

**Rationale**:
- Parser already tested and reliable
- Date is pre-parsed during vault scan
- No duplicate parsing overhead
- Simply check: `task.dueDate !== null`

---

### 3. How are previously synced tasks identified?

**Finding**: The plugin uses a block ID system managed by `src/vault/blockRefManager.ts`:

**Block ID Format**: `^task-[UUID]` (appended to task markdown)

**Example Task**:
```markdown
- [ ] Buy groceries 📅 2025-02-15 ^task-a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Sync Mapping System** (`src/sync/mapping.ts`):
```typescript
interface SyncMapping {
  blockId: string;        // Links to Obsidian task
  caldavUid: string;      // Links to CalDAV server
  // ... sync metadata
}
```

**Decision**: A task is "previously synced" if `task.blockId` exists AND there is a corresponding mapping in the mapping store.

**Rationale**:
- Block ID presence indicates the task was synced at least once
- Mapping store confirms the sync relationship is still valid
- This is the existing mechanism - no new tracking needed

**Implementation Strategy**:
```typescript
function hasSyncMapping(task: Task, mappings: Map<string, SyncMapping>): boolean {
  return task.blockId ? mappings.has(task.blockId) : false;
}
```

---

### 4. Where should the setting be stored and what should the default be?

**Finding**: Settings are defined in `src/settings.ts` and typed in `src/types.ts`:

**Current Settings Structure**:
```typescript
// src/types.ts
export interface CalDAVConfiguration {
  serverUrl: string;
  username: string;
  password: string;
  calendarPath: string;
  syncInterval: number;
  enableAutoSync: boolean;
  excludedFolders: string[];
  excludedTags: string[];
  completedTaskAgeDays: number;
  enableDebugLogging: boolean;
}

// src/settings.ts
export const DEFAULT_SETTINGS: CalDAVConfiguration = {
  // ... defaults
  excludedFolders: [],
  excludedTags: [],
  completedTaskAgeDays: 30,
  enableDebugLogging: false,
};
```

**Decision**: Add `syncOnlyTasksWithDueDate: boolean` with default `false`

**Rationale**:
- **Default false = backward compatible**: Existing users experience no change
- **Boolean type**: Simple, no validation needed
- **Naming convention**: Follows existing pattern (`enableAutoSync`, `enableDebugLogging`)
- **Placement**: Groups naturally with other filtering options

**Settings Migration**: None needed - Obsidian's `loadData()` handles missing fields gracefully by using defaults.

---

### 5. How should the UI be presented?

**Finding**: Settings UI is in `src/ui/settingsTab.ts` using Obsidian's settings API:

**Current Pattern**:
```typescript
// Checkbox for boolean settings
new Setting(containerEl)
  .setName('Enable auto-sync')
  .setDesc('Automatically sync tasks at regular intervals')
  .addToggle(toggle => toggle
    .setValue(this.plugin.settings.enableAutoSync)
    .onChange(async (value) => {
      this.plugin.settings.enableAutoSync = value;
      await this.plugin.saveSettings();
    }));
```

**Decision**: Add a checkbox in the sync settings section with clear labeling.

**UI Copy** (following Obsidian UX guidelines):
- **Name**: "Sync only tasks with due dates"
- **Description**: "When enabled, only tasks with due dates will be synced. Previously synced tasks will continue to sync even if their due date is removed."

**Placement**: After "Enable auto-sync" and before the exclusion settings (logical grouping).

**Rationale**:
- Follows existing UI patterns
- Clear, sentence-case copy (per constitution)
- Explains both the primary behavior AND the exception
- No technical jargon (user-friendly)

---

### 6. What are the performance implications?

**Finding**: Current filter function is called once per task during sync evaluation.

**Performance Analysis**:

**Current Filtering Overhead**: ~1-5µs per task (folder/tag string matching)

**New Due Date Filter Cost**:
```typescript
// Pseudo-implementation
if (config.syncOnlyTasksWithDueDate) {
  const hasMapping = mappings.has(task.blockId);
  if (!task.dueDate && !hasMapping) return false;
}
```

**Operations**:
1. Read boolean config value: ~1ns (cached in memory)
2. Check `task.dueDate !== null`: ~1ns (null comparison)
3. Map lookup `mappings.has()`: ~O(1) hash lookup, ~10-50ns
4. Boolean AND operation: ~1ns

**Total per-task overhead**: <100ns (0.0001ms)

**At scale (1000 tasks)**: <0.1ms total overhead

**Decision**: No special optimizations needed - negligible performance impact.

**Rationale**:
- All operations are O(1)
- No string parsing (date already parsed)
- No network calls
- Memory overhead: 1 boolean (1 byte)

---

### 7. How should edge cases be handled?

**Edge Case Analysis**:

#### Case 1: Task synced, due date removed, then due date added again
**Current Behavior**: Task has mapping → continues to sync
**New Behavior**: Task has mapping → continues to sync (unchanged)
**Decision**: No special handling needed

#### Case 2: User disables filter after using it
**Current Behavior**: N/A (feature doesn't exist)
**Expected Behavior**: Previously excluded tasks (no due date, no mapping) should now sync
**Decision**: Rely on standard sync logic - unsynced tasks will be treated as new and synced
**Rationale**: No retroactive tracking needed; normal sync handles this naturally

#### Case 3: Malformed date format
**Current Behavior**: Parser returns `null` for invalid dates
**New Behavior**: Treat as "no due date" → apply filter logic
**Decision**: Fail-safe - if date can't be parsed, treat as missing
**Rationale**: Prevents accidental sync of malformed tasks; user can fix and retry

#### Case 4: Task deleted from Obsidian
**Current Behavior**: Remains on CalDAV (manual cleanup required per spec)
**New Behavior**: Same (no change to deletion handling)
**Decision**: Out of scope for this feature
**Rationale**: Deletion handling is a separate concern specified as manual cleanup

#### Case 5: Due date modified (not removed, but changed)
**Current Behavior**: Task has mapping → syncs the new date
**New Behavior**: Task has mapping → syncs the new date (unchanged)
**Decision**: No special handling - modification continues to sync
**Rationale**: Filter only checks presence/absence of date, not specific value

---

## Technology Choices

### Filter Implementation Approach

**Options Considered**:

1. **Add to existing `shouldSync()` function** ✅ SELECTED
   - Pros: Minimal changes, consistent pattern, easy to test
   - Cons: None identified

2. **Create separate `filterByDueDate()` function**
   - Pros: Slightly more modular
   - Cons: Unnecessarily splits filtering logic, harder to maintain

3. **Implement in sync engine directly**
   - Pros: Centralized logic
   - Cons: Violates separation of concerns, harder to test

**Decision**: Option 1 - Add to existing `shouldSync()` function

**Rationale**: Maintains the established pattern where `filters.ts` is the single source of truth for all sync filtering logic.

---

### Testing Strategy

**Test Coverage Plan**:

1. **Unit Tests** (`tests/unit/filters.test.ts`):
   - Filter disabled: all tasks should sync (backward compatibility)
   - Filter enabled + task has due date → should sync
   - Filter enabled + task has no due date + no mapping → should NOT sync
   - Filter enabled + task has no due date + has mapping → should sync (legacy exception)

2. **Integration Tests** (`tests/integration/sync.test.ts`):
   - End-to-end: Sync task with due date, remove date, verify continues syncing
   - End-to-end: Enable filter, create task without date, verify not synced
   - Settings persistence: Toggle setting, restart plugin, verify setting retained

3. **Manual Testing Scenarios**:
   - Create tasks with/without due dates
   - Toggle setting and observe sync behavior
   - Remove due dates from synced tasks
   - Mobile platform verification

**Decision**: Comprehensive unit tests + integration tests + manual verification

**Rationale**: Covers all acceptance criteria from spec.md while maintaining test pyramid best practices.

---

## Best Practices Applied

### TypeScript Strict Mode
- All new code will use strict null checks
- No `any` types
- Explicit return types for public functions

### Obsidian Plugin Guidelines
- Settings persisted via standard `saveSettings()` API
- UI follows sentence case and arrow notation standards
- No breaking changes to existing APIs
- Backward compatible default behavior

### Performance
- No blocking operations during vault scan
- Leverages existing batched processing (50 files at a time)
- All filter operations are O(1) or O(n) where n = task count

### Maintainability
- Self-documenting code with clear variable names
- Minimal abstraction (no over-engineering)
- Consistent with existing codebase patterns
- Comprehensive test coverage

---

## Alternatives Considered

### Alternative 1: Allow date range filtering
**Description**: Let users specify "sync tasks due in next N days"
**Rejected Because**:
- Significantly increases complexity
- Requires date arithmetic and edge case handling
- User didn't request this functionality
- Can be added later if needed (YAGNI principle)

### Alternative 2: Make filter opt-out instead of opt-in
**Description**: Default to filtering, make users disable it
**Rejected Because**:
- Breaks backward compatibility (users would lose sync for dateless tasks)
- Violates principle of least surprise
- Constitution requires backward compatible defaults

### Alternative 3: Separate "sync once synced" from "due date filter"
**Description**: Make the legacy behavior a separate toggle
**Rejected Because**:
- Creates confusion (too many settings)
- The exception is implicit in the main feature
- User's request implies this behavior
- Simpler UX with single checkbox

---

## Dependencies

### Existing Code Dependencies
- `src/vault/taskParser.ts` - Due date parsing (no changes needed)
- `src/vault/blockRefManager.ts` - Block ID detection (no changes needed)
- `src/sync/mapping.ts` - Mapping store access (no changes needed)
- `src/sync/filters.ts` - Filter function (will be modified)

### External Dependencies
- None - feature uses existing dependencies only

---

## Migration & Rollout

### Settings Migration
**Required**: None - missing fields default to safe values

**Mechanism**: Obsidian's `Object.assign(DEFAULT_SETTINGS, loadedData)` pattern

### User Communication
**Release Notes Entry**:
```markdown
## New Feature: Due Date Filtering

Added a new option to sync only tasks with due dates to CalDAV.
When enabled, tasks without due dates will not be synced to your
calendar, reducing clutter. Previously synced tasks will continue
to sync even if their due date is removed.

This feature is disabled by default to maintain backward compatibility.
Enable it in Settings → CalDAV Task Sync → "Sync only tasks with due dates"
```

### Rollback Plan
If issues are discovered:
1. Users can disable the setting (restores old behavior)
2. No data loss (mappings preserved)
3. No migration required (backward compatible)

---

## Summary of Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Filter location | `src/sync/filters.ts` | Existing filter pattern |
| Setting name | `syncOnlyTasksWithDueDate` | Consistent naming convention |
| Default value | `false` | Backward compatibility |
| Due date detection | Use pre-parsed `task.dueDate` | Already available, no re-parsing |
| Sync mapping detection | Check `mappings.has(task.blockId)` | Existing mechanism |
| UI placement | After auto-sync toggle | Logical grouping |
| Test strategy | Unit + integration + manual | Complete coverage |
| Performance optimization | None needed | <0.1ms overhead at 1000 tasks |

---

## Open Questions

**None** - All technical questions resolved during codebase exploration.

---

**Research Status**: ✅ Complete
**Next Phase**: Phase 1 - Design & Contracts

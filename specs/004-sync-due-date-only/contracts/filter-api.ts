/**
 * Filter API Contract: Due Date Filter for Task Synchronization
 *
 * Feature: 004-sync-due-date-only
 * Date: 2026-02-02
 *
 * This contract defines the public API surface for the due date filtering feature.
 * All functions are internal to the plugin (not exposed to external consumers).
 */

/**
 * Configuration field addition to CalDAVConfiguration interface
 */
export interface CalDAVConfigurationAddition {
  /**
   * When true, only sync tasks that have due dates.
   * Exception: Tasks that were previously synced (have a sync mapping) will
   * continue to sync even if their due date is removed.
   *
   * @default false (maintains backward compatibility)
   */
  syncOnlyTasksWithDueDate: boolean;
}

/**
 * Filter function signature (modified)
 *
 * Location: src/sync/filters.ts
 *
 * Evaluates whether a task should be synced to CalDAV based on:
 * - Due date presence (if filter enabled)
 * - Folder exclusions
 * - Tag exclusions
 * - Completion age threshold
 *
 * @param task - The task to evaluate
 * @param config - Plugin configuration settings
 * @param mappings - Map of existing sync mappings (blockId -> SyncMapping)
 * @returns true if task should be synced, false otherwise
 *
 * @example
 * // Filter disabled - all tasks evaluated by other filters
 * const config = { syncOnlyTasksWithDueDate: false, ... };
 * shouldSync(task, config, mappings); // → applies folder/tag/age filters only
 *
 * @example
 * // Filter enabled - task with due date
 * const config = { syncOnlyTasksWithDueDate: true, ... };
 * const task = { dueDate: new Date('2025-02-15'), ... };
 * shouldSync(task, config, mappings); // → true (has due date)
 *
 * @example
 * // Filter enabled - task without due date, never synced
 * const config = { syncOnlyTasksWithDueDate: true, ... };
 * const task = { dueDate: null, blockId: '', ... };
 * shouldSync(task, config, mappings); // → false (no due date, not synced)
 *
 * @example
 * // Filter enabled - task without due date, previously synced
 * const config = { syncOnlyTasksWithDueDate: true, ... };
 * const task = { dueDate: null, blockId: 'task-abc123', ... };
 * const mappings = new Map([['task-abc123', syncMapping]]);
 * shouldSync(task, config, mappings); // → true (exception: was synced before)
 */
export type ShouldSyncFunction = (
  task: Task,
  config: CalDAVConfiguration,
  mappings: Map<string, SyncMapping>
) => boolean;

/**
 * Settings persistence contract
 *
 * Location: src/main.ts (saveSettings method)
 *
 * Settings are persisted to Obsidian's data.json automatically when changed.
 * The new field is included in the configuration object with no special handling.
 *
 * @example
 * // User toggles setting in UI
 * this.plugin.settings.syncOnlyTasksWithDueDate = true;
 * await this.plugin.saveSettings(); // → Persists entire config to data.json
 */
export interface SettingsPersistenceContract {
  /**
   * Save all plugin settings to disk
   * @returns Promise that resolves when settings are persisted
   */
  saveSettings(): Promise<void>;

  /**
   * Load plugin settings from disk
   * Missing fields are filled with DEFAULT_SETTINGS values
   * @returns Promise that resolves to loaded configuration
   */
  loadSettings(): Promise<CalDAVConfiguration>;
}

/**
 * UI Settings Component Contract
 *
 * Location: src/ui/settingsTab.ts
 *
 * Adds a checkbox control to the settings UI for the due date filter toggle.
 */
export interface DueDateFilterSettingUI {
  /**
   * Checkbox setting properties
   */
  name: 'Sync only tasks with due dates';
  description: 'When enabled, only tasks with due dates will be synced. Previously synced tasks will continue to sync even if their due date is removed.';
  type: 'toggle';

  /**
   * Initial value bound to config
   */
  getValue(): boolean;

  /**
   * Change handler - saves settings on toggle
   * @param value - New checkbox state
   */
  onChange(value: boolean): Promise<void>;
}

/**
 * Helper function contract (internal)
 *
 * Location: src/sync/filters.ts (new helper function)
 *
 * Determines if a task has been previously synced to CalDAV.
 * A task is considered "previously synced" if:
 * 1. It has a blockId (non-empty string)
 * 2. A sync mapping exists for that blockId
 *
 * @param task - The task to check
 * @param mappings - Map of existing sync mappings
 * @returns true if task was previously synced, false otherwise
 *
 * @example
 * const task = { blockId: 'task-abc123', ... };
 * const mappings = new Map([['task-abc123', syncMapping]]);
 * hasSyncMapping(task, mappings); // → true
 *
 * @example
 * const task = { blockId: '', ... }; // Empty blockId
 * hasSyncMapping(task, mappings); // → false
 */
export type HasSyncMappingFunction = (
  task: Task,
  mappings: Map<string, SyncMapping>
) => boolean;

/**
 * Filter logic specification
 *
 * Pseudocode representation of the filtering algorithm:
 *
 * ```
 * function shouldSync(task, config, mappings):
 *   // NEW: Due date filter (if enabled)
 *   if config.syncOnlyTasksWithDueDate is true:
 *     if task.dueDate is null:
 *       if NOT hasSyncMapping(task, mappings):
 *         return false  // No due date + never synced → skip
 *       // else: has mapping → continue to other filters (exception)
 *     // else: has due date → continue to other filters
 *
 *   // EXISTING: Folder exclusion filter
 *   if task.filePath starts with any config.excludedFolders:
 *     return false
 *
 *   // EXISTING: Tag exclusion filter
 *   if any task.tags in config.excludedTags:
 *     return false
 *
 *   // EXISTING: Completion age filter
 *   if task.status is "completed":
 *     age = today - task.completionDate
 *     if age > config.completedTaskAgeDays:
 *       return false
 *
 *   return true  // Passed all filters → sync this task
 * ```
 */

/**
 * Error handling contract
 *
 * The filter function is fail-safe:
 * - Invalid/malformed due dates are treated as null (no due date)
 * - Missing blockId is treated as empty string (never synced)
 * - If mappings lookup fails, defaults to false (not synced)
 * - Filter errors should log but not crash sync process
 */
export interface FilterErrorHandling {
  /**
   * Behavior when task.dueDate is invalid
   * @returns Treats as null (no due date), applies filter logic
   */
  onInvalidDueDate: 'treat-as-null';

  /**
   * Behavior when task.blockId is missing/undefined
   * @returns Treats as empty string (no mapping)
   */
  onMissingBlockId: 'treat-as-empty';

  /**
   * Behavior when mapping lookup fails
   * @returns Defaults to false (not synced)
   */
  onMappingLookupError: 'default-to-not-synced';
}

/**
 * Performance guarantees
 */
export interface PerformanceContract {
  /**
   * Time complexity per task evaluation
   */
  timeComplexity: 'O(1)';

  /**
   * Maximum overhead per task
   */
  maxOverheadPerTask: '<100ns';

  /**
   * Total overhead for 1000 tasks
   */
  totalOverhead: '<0.1ms';

  /**
   * Memory overhead
   */
  memoryOverhead: '1 byte (boolean)';
}

/**
 * Backward compatibility guarantees
 */
export interface BackwardCompatibilityContract {
  /**
   * Default value for new setting
   */
  defaultValue: false;

  /**
   * Behavior when setting is missing (old data.json)
   * @returns Defaults to false (no filtering, same as before)
   */
  missingFieldBehavior: 'default-to-false';

  /**
   * Breaking changes
   */
  breakingChanges: 'none';

  /**
   * Migration required
   */
  migrationRequired: false;
}

/**
 * Test coverage contract
 */
export interface TestCoverageContract {
  unitTests: {
    'filter-disabled-all-tasks-sync': 'REQUIRED';
    'filter-enabled-with-due-date': 'REQUIRED';
    'filter-enabled-no-due-date-no-mapping': 'REQUIRED';
    'filter-enabled-no-due-date-has-mapping': 'REQUIRED';
  };

  integrationTests: {
    'sync-task-remove-due-date-continues-syncing': 'REQUIRED';
    'enable-filter-new-task-no-date-not-synced': 'REQUIRED';
    'settings-persistence-across-restart': 'REQUIRED';
  };
}

/**
 * Type definitions (for reference)
 * These types already exist in src/types.ts
 */

interface Task {
  blockId: string;
  filePath: string;
  lineNumber: number;
  description: string;
  dueDate: Date | null;
  status: TaskStatus;
  rawLine: string;
  tags: string[];
  completionDate: Date | null;
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
  enableDebugLogging: boolean;
  syncOnlyTasksWithDueDate: boolean; // NEW FIELD
}

interface SyncMapping {
  blockId: string;
  caldavUid: string;
  lastSyncTimestamp: Date;
  lastKnownContentHash: string;
  lastKnownObsidianModified: Date;
  lastKnownCalDAVModified: Date;
  caldavEtag: string;
  caldavHref: string;
}

type TaskStatus = 'open' | 'completed';

/**
 * Sync Engine Integration Contract
 *
 * Defines modifications to the existing sync engine to integrate Obsidian URI generation.
 * This contract documents changes to src/sync/engine.ts.
 *
 * Module: src/sync/engine.ts (existing file - minimal modifications)
 */

import { Task } from '../../../src/types';
import { buildObsidianURI, buildDescriptionWithURI } from './uriBuilder';

// ============================================================================
// Modified Method: createTaskOnCalDAV
// ============================================================================

/**
 * Creates a new task on the CalDAV server with Obsidian URI in DESCRIPTION.
 *
 * MODIFICATIONS:
 * 1. Get vault name via this.vault.getName()
 * 2. Validate task.blockId before attempting URI generation
 * 3. Generate Obsidian URI using uriBuilder.buildObsidianURI()
 * 4. Format DESCRIPTION with buildDescriptionWithURI()
 * 5. Pass description to client.createTask() (new optional parameter)
 *
 * @param task - The Obsidian task to sync
 * @returns Promise resolving when task is created on CalDAV
 * @throws Error if CalDAV creation fails (existing behavior)
 *
 * @example Before (existing implementation)
 * ```typescript
 * private async createTaskOnCalDAV(task: Task): Promise<void> {
 *   const vtodoData = taskToVTODO(task);
 *   await this.caldavClient.createTask(vtodoData);
 *   // ... store mapping
 * }
 * ```
 *
 * @example After (with URI generation)
 * ```typescript
 * private async createTaskOnCalDAV(task: Task): Promise<void> {
 *   const vtodoData = taskToVTODO(task);
 *
 *   // NEW: Generate Obsidian URI
 *   let description: string | undefined;
 *   try {
 *     const vaultName = this.vault.getName();
 *     const uri = buildObsidianURI(vaultName, task.filePath, task.blockId);
 *     description = buildDescriptionWithURI(uri);
 *   } catch (error) {
 *     console.warn(`Skipping URI generation for task: ${error.message}`);
 *     // Continue without URI - graceful degradation
 *   }
 *
 *   await this.caldavClient.createTask(vtodoData, description);
 *   // ... store mapping (unchanged)
 * }
 * ```
 */
interface CreateTaskOnCalDAVModification {
  /**
   * Original signature (unchanged):
   * private async createTaskOnCalDAV(task: Task): Promise<void>
   *
   * Implementation changes:
   * - Add vault name retrieval: const vaultName = this.vault.getName()
   * - Add URI generation in try-catch block
   * - Pass optional description to client.createTask()
   *
   * Lines affected: ~10 lines added (URI generation block)
   * Location: src/sync/engine.ts line ~520 (approximate)
   */
  method: 'createTaskOnCalDAV';
  changeType: 'LOGIC_ADDITION';
  linesAdded: 10;
  linesRemoved: 0;
  breakingChange: false;
}

// ============================================================================
// Unchanged Methods (for reference)
// ============================================================================

/**
 * These methods remain UNCHANGED - documented here for clarity.
 */

/**
 * updateCalDAVTask: NO CHANGES NEEDED
 *
 * Rationale: Property preservation pattern in updateTaskWithPreservation()
 * already handles DESCRIPTION field correctly. When updating a task:
 * 1. Existing VTODO is fetched from server (includes DESCRIPTION)
 * 2. Only managed fields are updated (SUMMARY, STATUS, DUE)
 * 3. DESCRIPTION is preserved automatically
 *
 * Location: src/sync/engine.ts line ~650 (approximate)
 */
interface UpdateCalDAVTaskNoChange {
  method: 'updateCalDAVTask';
  changeType: 'NONE';
  linesAdded: 0;
  linesRemoved: 0;
  rationale: 'Property preservation already handles DESCRIPTION';
}

/**
 * handleUntrackedTask: NO CHANGES NEEDED
 *
 * Rationale: This method orchestrates task creation but delegates to
 * createTaskOnCalDAV(). All URI generation logic is contained within
 * createTaskOnCalDAV(), so no changes needed here.
 *
 * Location: src/sync/engine.ts line ~270 (approximate)
 */
interface HandleUntrackedTaskNoChange {
  method: 'handleUntrackedTask';
  changeType: 'NONE';
  linesAdded: 0;
  linesRemoved: 0;
  rationale: 'Delegates to createTaskOnCalDAV which handles URI generation';
}

// ============================================================================
// New Import Required
// ============================================================================

/**
 * Add import at top of src/sync/engine.ts:
 *
 * import { buildObsidianURI, buildDescriptionWithURI } from '../obsidian/uriBuilder';
 *
 * Location: src/sync/engine.ts line ~1-10 (import section)
 */

// ============================================================================
// Error Handling Contract
// ============================================================================

/**
 * Error handling strategy for URI generation within createTaskOnCalDAV:
 *
 * 1. Wrap URI generation in try-catch
 * 2. Log warnings for recoverable errors (missing block ID, invalid format)
 * 3. Continue task creation without URI (graceful degradation)
 * 4. Never throw from URI generation (task sync must not fail due to URI issues)
 *
 * Error scenarios:
 * - Missing block ID → Log warning, skip URI, create task without DESCRIPTION
 * - Invalid block ID format → Log warning, skip URI, create task without DESCRIPTION
 * - Empty vault name → Log error, skip URI, create task without DESCRIPTION (rare)
 * - encodeURIComponent throws → Log error, skip URI, create task without DESCRIPTION (extremely rare)
 *
 * Success scenario:
 * - Valid inputs → Generate URI, create task with DESCRIPTION containing URI
 */
export interface URIGenerationErrorHandling {
  strategy: 'GRACEFUL_DEGRADATION';
  throwErrors: false;
  logLevel: 'warn' | 'error';
  fallbackBehavior: 'CREATE_TASK_WITHOUT_URI';
}

// ============================================================================
// Testing Contract
// ============================================================================

/**
 * Test scenarios for sync engine integration:
 *
 * 1. Successful URI generation and task creation
 *    - Input: Task with valid blockId, filePath
 *    - Expected: CalDAV task created with DESCRIPTION containing URI
 *
 * 2. Missing block ID (graceful degradation)
 *    - Input: Task with empty blockId
 *    - Expected: CalDAV task created WITHOUT DESCRIPTION, warning logged
 *
 * 3. Invalid block ID format (graceful degradation)
 *    - Input: Task with malformed blockId (e.g., "invalid")
 *    - Expected: CalDAV task created WITHOUT DESCRIPTION, warning logged
 *
 * 4. Empty vault name (edge case)
 *    - Input: vault.getName() returns ""
 *    - Expected: CalDAV task created WITHOUT DESCRIPTION, error logged
 *
 * 5. Special characters in paths
 *    - Input: File path with spaces, Unicode, special chars
 *    - Expected: URI properly encoded, task created with valid URI
 *
 * 6. Task update preserves DESCRIPTION
 *    - Input: Update existing synced task (change status)
 *    - Expected: CalDAV task updated, DESCRIPTION unchanged
 *
 * Testing method: Manual testing in dev vault (no automated tests initially)
 */

// ============================================================================
// Performance Contract
// ============================================================================

/**
 * Performance requirements:
 *
 * - URI generation overhead: <5ms per task
 * - No additional network requests (vault.getName() is in-memory)
 * - No additional disk I/O
 * - Minimal memory allocation (string concatenation only)
 *
 * Profiling targets:
 * - 100 tasks synced: <500ms total URI generation overhead
 * - 1000 tasks synced: <5s total URI generation overhead
 *
 * Optimization notes:
 * - Vault name could be cached (called once per sync cycle, not per task)
 * - Future optimization: Pass vaultName to createTaskOnCalDAV() to avoid repeated calls
 * - Initial implementation: Call vault.getName() per task (simplicity over optimization)
 */
export interface PerformanceRequirements {
  uriGenerationTimePerTask: '<5ms';
  additionalNetworkRequests: 0;
  additionalDiskIO: 0;
  memoryOverheadPerTask: '<1KB';
}

// ============================================================================
// Dependency Injection (Future Enhancement)
// ============================================================================

/**
 * Alternative design: Inject vault name into SyncEngine constructor
 *
 * Benefits:
 * - Vault name retrieved once per plugin load
 * - Slightly better performance for large vaults
 * - Easier to mock for testing
 *
 * Trade-offs:
 * - More complex initialization
 * - Requires SyncEngine constructor modification
 *
 * Decision: Use inline vault.getName() for v1 (simpler)
 * Future: Consider DI if performance profiling shows overhead
 */

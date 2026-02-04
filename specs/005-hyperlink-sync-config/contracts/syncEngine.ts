/**
 * Sync Engine Integration Contract
 *
 * Defines modifications to `src/sync/engine.ts` to integrate hyperlink
 * processing into the create and update paths.
 *
 * Module: src/sync/engine.ts (existing file — modifications in two methods)
 */

import { Task } from '../../../src/types';
import { HyperlinkSyncMode } from '../../../src/types';
import { processDescription } from './hyperlinkProcessor';

// ============================================================================
// New Import Required
// ============================================================================

/**
 * Add import at top of src/sync/engine.ts:
 *
 * import { processDescription } from './hyperlinkProcessor';
 *
 * Note: HyperlinkSyncMode is already importable from '../types' once the
 * enum is added there.
 */

// ============================================================================
// Modified Method: createTaskOnCalDAV
// ============================================================================

/**
 * Creates a new task on CalDAV with hyperlink-processed summary and
 * (optionally) extracted links in DESCRIPTION.
 *
 * MODIFICATIONS (relative to current code at engine.ts:544-595):
 *
 * 1. After `taskToVTODO(task)` produces vtodoData, call:
 *      const processed = processDescription(vtodoData.summary, this.config.hyperlinkSyncMode);
 *      vtodoData.summary = processed.summary;    // <-- use processed summary
 *
 * 2. In the existing Obsidian URI try-catch block, when assembling `description`:
 *      - If processed.extractedLinksBlock is non-empty AND uri was generated:
 *          description = buildDescriptionWithURI(uri, processed.extractedLinksBlock);
 *      - If processed.extractedLinksBlock is non-empty BUT no uri:
 *          description = processed.extractedLinksBlock;
 *      - If processed.extractedLinksBlock is empty:
 *          description = buildDescriptionWithURI(uri);  // existing behavior unchanged
 *
 * 3. The rest of the method (client.createTask call, mapping storage) is unchanged.
 *
 * IMPORTANT: `processDescription` is called BEFORE the URI try-catch block.
 * The `extractedLinksBlock` must be available when assembling the description.
 *
 * @example  (pseudocode for the modified section)
 * ```typescript
 * private async createTaskOnCalDAV(task: Task): Promise<void> {
 *   const vtodoData = taskToVTODO(task);
 *
 *   // NEW: Hyperlink processing
 *   const processed = processDescription(vtodoData.summary, this.config.hyperlinkSyncMode);
 *
 *   // Generate Obsidian URI with error handling (existing pattern)
 *   let description: string | undefined;
 *   try {
 *     const vaultName = this.vault.getName();
 *     if (!task.blockId) {
 *       console.warn('Skipping URI generation: task missing block ID');
 *     } else {
 *       const uri = buildObsidianURI(vaultName, task.filePath, task.blockId);
 *       // NEW: Pass extractedLinksBlock as existingContent
 *       description = buildDescriptionWithURI(uri, processed.extractedLinksBlock || undefined);
 *     }
 *   } catch (error) {
 *     console.warn(`Failed to generate Obsidian URI: ${error.message}`);
 *   }
 *
 *   // NEW: If no URI but we have links, still set description
 *   if (!description && processed.extractedLinksBlock) {
 *     description = processed.extractedLinksBlock;
 *   }
 *
 *   // Create task with PROCESSED summary (not original)
 *   const caldavTask = await this.client.createTask(
 *     processed.summary,       // ← processed, not vtodoData.summary
 *     vtodoData.due,
 *     vtodoData.status,
 *     description
 *   );
 *
 *   // ... mapping storage unchanged ...
 * }
 * ```
 */
interface CreateTaskOnCalDAVModification {
  method: 'createTaskOnCalDAV';
  changeType: 'LOGIC_ADDITION';
  linesAdded: 8;   // processDescription call + extractedLinksBlock integration
  linesRemoved: 2; // vtodoData.summary replaced with processed.summary in createTask call
  breakingChange: false;
}

// ============================================================================
// Modified Method: updateCalDAVTask
// ============================================================================

/**
 * Updates a CalDAV task with hyperlink-processed summary.
 *
 * MODIFICATIONS (relative to current code at engine.ts:695-737):
 *
 * 1. After `taskToVTODO(task)` produces vtodoData, call:
 *      const processed = processDescription(vtodoData.summary, this.config.hyperlinkSyncMode);
 *
 * 2. Pass `processed.summary` to `updateTaskWithPreservation()` instead of `vtodoData.summary`.
 *
 * 3. `processed.extractedLinksBlock` is intentionally IGNORED on updates.
 *    DESCRIPTION is preserved by the property preservation pattern (feature 002).
 *    Links extracted on create stay in DESCRIPTION; links in tasks that were
 *    created under "Keep" mode are never retroactively added to DESCRIPTION.
 *
 * @example  (pseudocode for the modified section)
 * ```typescript
 * private async updateCalDAVTask(task: Task, mapping: SyncMapping): Promise<void> {
 *   // ... existing validation ...
 *
 *   const vtodoData = taskToVTODO(task);
 *
 *   // NEW: Hyperlink processing (summary only; DESCRIPTION preserved)
 *   const processed = processDescription(vtodoData.summary, this.config.hyperlinkSyncMode);
 *
 *   const updatedTask = await this.client.updateTaskWithPreservation(
 *     mapping.caldavUid,
 *     processed.summary,      // ← processed, not vtodoData.summary
 *     vtodoData.due,
 *     vtodoData.status,
 *     mapping.caldavEtag,
 *     mapping.caldavHref
 *   );
 *
 *   // ... mapping update unchanged ...
 * }
 * ```
 */
interface UpdateCalDAVTaskModification {
  method: 'updateCalDAVTask';
  changeType: 'LOGIC_ADDITION';
  linesAdded: 3;   // processDescription call
  linesRemoved: 1; // vtodoData.summary replaced with processed.summary
  breakingChange: false;
}

// ============================================================================
// Unchanged Methods (for reference)
// ============================================================================

/**
 * handleUntrackedTask: NO CHANGES
 * Delegates to createTaskOnCalDAV which handles all processing.
 *
 * syncBidirectional: NO CHANGES
 * Orchestration logic; delegates to updateCalDAVTask/updateObsidianTask.
 *
 * updateObsidianTask: NO CHANGES
 * CalDAV→Obsidian direction. Spec explicitly excludes this direction
 * from hyperlink processing (Assumptions: "hyperlink processing only
 * applies in the Obsidian → CalDAV sync direction").
 *
 * needsReconciliation: NO CHANGES
 * Compares task.description (raw) with caldavTask.summary. Note: after
 * this feature, the CalDAV summary may differ from task.description if
 * mode is "move" or "strip". This means reconciliation may detect a
 * "mismatch" on tasks where hyperlinks were processed. This is correct
 * behavior — the engine will push the processed summary to CalDAV,
 * which is the intended effect.
 */

// ============================================================================
// Error Handling Contract
// ============================================================================

/**
 * processDescription() is a pure function that never throws:
 *   - Empty description → returns { summary: "", extractedLinksBlock: "" }
 *   - Regex failure → impossible (JS regex engine; matchAll on valid string)
 *   - Any unexpected state → empty summary guard catches it
 *
 * Therefore: no try-catch wrapper needed around processDescription() calls.
 * The existing try-catch around URI generation remains unchanged.
 */
export interface HyperlinkProcessingErrorContract {
  throwsExceptions: false;
  requiresTryCatch: false;
  emptyGuard: 'falls back to original description';
}

// ============================================================================
// Performance Contract
// ============================================================================

/**
 * Performance impact:
 *   - processDescription(): <1ms per task (regex + string replace on <200 char strings)
 *   - No additional network requests
 *   - No additional disk I/O
 *   - Called once per task in create path, once per task in update path
 *   - 1000 tasks: <1s total overhead from hyperlink processing
 */
export interface PerformanceContract {
  processingTimePerTask: '<1ms';
  additionalNetworkRequests: 0;
  additionalDiskIO: 0;
}

/**
 * Sync filter implementation for task filtering
 * Based on tasks.md T039 specification and data-model.md
 * Extended for 004-sync-due-date-only: T015-T018, T026-T027
 */

import { Task, TaskStatus, CalDAVConfiguration, CalDAVTask, VTODOStatus, SyncMapping } from "../types";

/**
 * Helper function to check if a task has been previously synced (T015)
 * @param task The task to check
 * @param mappings Map of existing sync mappings (blockId -> SyncMapping)
 * @returns true if task was previously synced, false otherwise
 */
function hasSyncMapping(
	task: Task,
	mappings: Map<string, SyncMapping>
): boolean {
	// Treat empty blockId as never synced (T027)
	if (!task.blockId || task.blockId === "") {
		return false;
	}
	return mappings.has(task.blockId);
}

/**
 * Sync filter class for evaluating which tasks should be synced
 */
export class SyncFilter {
	private excludedFolders: Set<string>;
	private excludedTags: Set<string>;
	private completedTaskAgeThreshold: Date;

	constructor(config: CalDAVConfiguration) {
		this.excludedFolders = new Set(config.excludedFolders);
		this.excludedTags = new Set(config.excludedTags);

		// Calculate age threshold date
		const thresholdDate = new Date();
		thresholdDate.setDate(thresholdDate.getDate() - config.completedTaskAgeDays);
		this.completedTaskAgeThreshold = thresholdDate;
	}

	/**
	 * Determine if a task should be synced based on filters (T016-T017, T026)
	 * @param task The task to evaluate
	 * @param config CalDAV configuration with filter settings
	 * @param mappings Map of existing sync mappings (for due date filter exception)
	 * @returns true if task should be synced, false otherwise
	 */
	shouldSync(task: Task, config: CalDAVConfiguration, mappings: Map<string, SyncMapping>): boolean {
		// Due date filter (T017, T026 - if enabled)
		if (config.syncOnlyTasksWithDueDate) {
			// If task has no due date AND was never synced → skip (T017)
			// Exception: if task was previously synced, continue to sync it (T026)
			if (!task.dueDate && !hasSyncMapping(task, mappings)) {
				return false;
			}
		}

		// Check folder exclusion
		if (this.matchesFolderExclusion(task.filePath)) {
			return false;
		}

		// Check tag exclusion
		if (this.hasExcludedTag(task.tags)) {
			return false;
		}

		// Check age threshold for completed tasks
		if (this.isCompletedTooOld(task)) {
			return false;
		}

		return true;
	}

	/**
	 * Check if task file path matches folder exclusion rules
	 * @param filePath The file path to check
	 * @returns true if path should be excluded
	 */
	private matchesFolderExclusion(filePath: string): boolean {
		for (const excludedFolder of this.excludedFolders) {
			// Check if file path starts with excluded folder
			// Also check for subfolders (folder + any path)
			if (filePath.startsWith(excludedFolder)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Check if task has any excluded tags
	 * @param tags The task tags to check
	 * @returns true if task has excluded tag
	 */
	private hasExcludedTag(tags: string[]): boolean {
		for (const tag of tags) {
			if (this.excludedTags.has(tag)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Check if completed task is too old based on age threshold (T067)
	 * @param task The task to check
	 * @returns true if task is completed and too old
	 */
	private isCompletedTooOld(task: Task): boolean {
		// Only apply to completed tasks
		if (task.status !== TaskStatus.Completed) {
			return false;
		}

		// If completedTaskAgeDays is 0, sync all completed tasks
		if (this.completedTaskAgeThreshold.getTime() === 0) {
			return false;
		}

		// If no completion date is available, use current date as fallback
		// This ensures completed tasks without explicit dates are still subject to filtering
		const completionDate = task.completionDate || new Date();

		// Check if completion date is older than threshold
		return completionDate < this.completedTaskAgeThreshold;
	}

	/**
	 * Determine if a CalDAV task should be synced based on age filter
	 * Note: Folder and tag filters don't apply to CalDAV tasks since we don't have that context
	 * @param caldavTask The CalDAV task to evaluate
	 * @returns true if task should be synced, false otherwise
	 */
	shouldSyncCalDAVTask(caldavTask: CalDAVTask): boolean {
		// Only filter completed tasks by age
		if (caldavTask.status !== VTODOStatus.Completed) {
			return true; // Sync all non-completed tasks
		}

		// If completedTaskAgeDays is 0, sync all completed tasks
		if (this.completedTaskAgeThreshold.getTime() === 0) {
			return true;
		}

		// Use lastModified as proxy for completion date
		// This is the best we can do since CalDAV doesn't always have a separate completion date
		const completionDate = caldavTask.lastModified;

		// Check if completion date is older than threshold
		return completionDate >= this.completedTaskAgeThreshold;
	}
}

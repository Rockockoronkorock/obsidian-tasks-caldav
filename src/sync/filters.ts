/**
 * Sync filter implementation for task filtering
 * Based on tasks.md T039 specification and data-model.md
 */

import { Task, TaskStatus, CalDAVConfiguration } from "../types";

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
	 * Determine if a task should be synced based on filters
	 * @param task The task to evaluate
	 * @returns true if task should be synced, false otherwise
	 */
	shouldSync(task: Task): boolean {
		// For now, return true (placeholder implementation)
		// Full implementation will be added in Phase 8 (US6)

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
	 * Check if completed task is too old based on age threshold
	 * @param task The task to check
	 * @returns true if task is completed and too old
	 */
	private isCompletedTooOld(task: Task): boolean {
		// Only apply to completed tasks
		if (task.status !== TaskStatus.Completed) {
			return false;
		}

		// For now, we don't have completion date tracking
		// This will be enhanced in Phase 8 (US6) if needed
		// Placeholder: return false to not filter by age yet
		return false;
	}
}

/**
 * Task file writer for updating task lines in vault files
 * Based on tasks.md T036 specification
 */

import { Vault, TFile, App } from "obsidian";
import { Task, TaskStatus } from "../types";

/**
 * Interface for the Obsidian Tasks Plugin API v1
 */
interface TasksPluginAPI {
	executeToggleTaskDoneCommand(line: string, path: string): string;
	createTaskLineModal(): Promise<string>;
	editTaskLineModal(taskLine: string): Promise<string>;
}

/**
 * Check if the Obsidian Tasks Plugin is available and return its API
 * @param app The Obsidian app instance
 * @returns The Tasks Plugin API or null if not available
 */
function getTasksPluginAPI(app: App): TasksPluginAPI | null {
	try {
		const plugin = (app as any).plugins?.plugins?.['obsidian-tasks-plugin'];
		if (plugin?.apiV1) {
			return plugin.apiV1 as TasksPluginAPI;
		}
	} catch (error) {
		console.warn('Failed to access Tasks Plugin API:', error);
	}
	return null;
}

/**
 * Update a task line in the vault
 * @param vault The Obsidian vault instance
 * @param task The task with updated properties
 * @param newLine The new task line content
 */
export async function updateTaskLine(vault: Vault, task: Task, newLine: string): Promise<void> {
	try {
		// Get the file
		const file = vault.getAbstractFileByPath(task.filePath);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`File not found: ${task.filePath}`);
		}

		// Read file content
		const content = await vault.read(file);
		const lines = content.split("\n");

		// Validate line number
		if (task.lineNumber < 1 || task.lineNumber > lines.length) {
			throw new Error(`Invalid line number: ${task.lineNumber} (file has ${lines.length} lines)`);
		}

		// Update the specific line (lineNumber is 1-indexed)
		lines[task.lineNumber - 1] = newLine;

		// Write back to file
		const newContent = lines.join("\n");
		await vault.modify(file, newContent);
	} catch (error) {
		console.error(`Error updating task at ${task.filePath}:${task.lineNumber}:`, error);
		throw error;
	}
}

/**
 * Build a task line from task properties
 * @param description Task description
 * @param status Task status
 * @param dueDate Optional due date
 * @param tags Optional tags
 * @param blockId Optional block ID
 * @returns Formatted task line
 */
export function buildTaskLine(
	description: string,
	status: TaskStatus,
	dueDate: Date | null,
	tags: string[],
	blockId?: string
): string {
	// Build task marker
	const statusMarker = status === TaskStatus.Open ? ' ' : 'x';
	let line = `- [${statusMarker}] ${description}`;

	// Add due date if present
	if (dueDate) {
		const dateStr = formatDateForTasks(dueDate);
		line += ` 📅 ${dateStr}`;
	}

	// Tags are already included in description, no need to add separately

	// Add block ID if present
	if (blockId) {
		line += ` ^${blockId}`;
	}

	return line;
}

/**
 * Format date for Tasks plugin format (YYYY-MM-DD)
 * @param date The date to format
 * @returns Formatted date string
 */
function formatDateForTasks(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * Update a task in the vault with new properties from CalDAV
 * Implements T055: Obsidian task update for CalDAV-to-Obsidian sync
 *
 * When the Obsidian Tasks Plugin is available, uses its API for status toggles
 * to properly handle recurrence patterns and user preferences. Falls back to
 * direct editing when the plugin is unavailable or when updating other properties.
 *
 * @param app The Obsidian app instance
 * @param vault The Obsidian vault instance
 * @param task The existing task in the vault
 * @param newDescription Updated description
 * @param newDueDate Updated due date (or null)
 * @param newStatus Updated status
 */
export async function updateTaskInVault(
	app: App,
	vault: Vault,
	task: Task,
	newDescription: string,
	newDueDate: Date | null,
	newStatus: TaskStatus
): Promise<void> {
	// Check if only status is changing (description and due date unchanged)
	const descriptionChanged = task.description !== newDescription;
	const dueDateChanged = !datesEqual(task.dueDate, newDueDate);
	const statusChanged = task.status !== newStatus;

	// Try to use Tasks Plugin API if only status is changing
	if (statusChanged && !descriptionChanged && !dueDateChanged) {
		const tasksAPI = getTasksPluginAPI(app);
		if (tasksAPI) {
			try {
				// Use Tasks Plugin API to toggle status (handles recurrence properly)
				const updatedLine = tasksAPI.executeToggleTaskDoneCommand(
					task.rawLine,
					task.filePath
				);

				// Update the task line in the vault
				await updateTaskLine(vault, task, updatedLine);

				// Update task object with new values
				task.status = newStatus;
				task.rawLine = updatedLine;

				console.debug('Updated task status using Tasks Plugin API');
				return;
			} catch (error) {
				console.warn('Failed to use Tasks Plugin API, falling back to direct edit:', error);
				// Fall through to direct editing
			}
		}
	}

	// Direct editing: build new task line with updated properties
	const newLine = buildTaskLine(
		newDescription,
		newStatus,
		newDueDate,
		task.tags,
		task.blockId
	);

	// Update the task line in the vault
	await updateTaskLine(vault, task, newLine);

	// Update task object with new values
	task.description = newDescription;
	task.dueDate = newDueDate;
	task.status = newStatus;
	task.rawLine = newLine;
}

/**
 * Helper function to compare two dates (null-safe)
 * @param date1 First date or null
 * @param date2 Second date or null
 * @returns true if dates are equal (including both null)
 */
function datesEqual(date1: Date | null, date2: Date | null): boolean {
	if (date1 === null && date2 === null) return true;
	if (date1 === null || date2 === null) return false;
	// Compare date-only (ignore time)
	return date1.getUTCFullYear() === date2.getUTCFullYear() &&
		date1.getUTCMonth() === date2.getUTCMonth() &&
		date1.getUTCDate() === date2.getUTCDate();
}

/**
 * Task file writer for updating task lines in vault files
 * Based on tasks.md T036 specification
 */

import { Vault, TFile } from "obsidian";
import { Task, TaskStatus } from "../types";

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
 * @param vault The Obsidian vault instance
 * @param task The existing task in the vault
 * @param newDescription Updated description
 * @param newDueDate Updated due date (or null)
 * @param newStatus Updated status
 */
export async function updateTaskInVault(
	vault: Vault,
	task: Task,
	newDescription: string,
	newDueDate: Date | null,
	newStatus: TaskStatus
): Promise<void> {
	// Build new task line with updated properties
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

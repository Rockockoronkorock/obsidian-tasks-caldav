/**
 * Vault scanner for discovering tasks in Obsidian vault
 * Based on tasks.md T033 specification
 * Implements T077: Optimize vault scanning for large vaults
 */

import { Vault, TFile } from "obsidian";
import { Task } from "../types";
import { parseTaskLine } from "./taskParser";
import { Logger } from "../sync/logger";

/**
 * Batch size for processing files
 * Process this many files before yielding to event loop
 */
const BATCH_SIZE = 50;

/**
 * Scan the vault for all task items
 * Implements T077: Batch processing for large vaults
 * @param vault The Obsidian vault instance
 * @returns Array of tasks found in the vault
 */
export async function scanVaultForTasks(vault: Vault): Promise<Task[]> {
	const tasks: Task[] = [];

	// Get all markdown files in the vault
	// Note: getMarkdownFiles() already filters out binary files
	const markdownFiles = vault.getMarkdownFiles();

	Logger.debug(`Scanning ${markdownFiles.length} markdown files for tasks`);

	// Process files in batches to avoid blocking the UI
	for (let i = 0; i < markdownFiles.length; i += BATCH_SIZE) {
		const batch = markdownFiles.slice(i, i + BATCH_SIZE);

		for (const file of batch) {
			const fileTasks = await scanFileForTasks(vault, file);
			if (fileTasks.length > 0) {
				tasks.push(...fileTasks);
			}
		}

		// Yield to event loop between batches
		if (i + BATCH_SIZE < markdownFiles.length) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}

	Logger.debug(`Found ${tasks.length} tasks across ${markdownFiles.length} files`);

	return tasks;
}

/**
 * Scan a single file for tasks
 * Implements T077: Optimized file scanning with early exit
 * @param vault The Obsidian vault instance
 * @param file The file to scan
 * @returns Array of tasks found in the file
 */
async function scanFileForTasks(vault: Vault, file: TFile): Promise<Task[]> {
	const tasks: Task[] = [];

	try {
		// Read file content
		const content = await vault.read(file);

		// Early exit if file doesn't contain any task markers
		// This optimization skips parsing for files without tasks
		if (!content.includes('- [ ]') && !content.includes('- [x]') && !content.includes('- [X]')) {
			return tasks;
		}

		const lines = content.split("\n");

		// Process each line
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line) continue; // Skip undefined/empty lines

			const lineNumber = i + 1; // Line numbers start at 1

			// Check if line contains a task marker
			if (isTaskLine(line)) {
				const taskResult = parseTaskLine(line, file.path, lineNumber);
				if (taskResult) {
					Logger.debug(`Found task in ${file.path}:${lineNumber} - ${taskResult.description}`);
					tasks.push(taskResult);
				}
			}
		}
	} catch (error) {
		Logger.error(`Error scanning file ${file.path}`, error);
	}

	return tasks;
}

/**
 * Check if a line is a task line
 * @param line The line to check
 * @returns true if the line is a task
 */
function isTaskLine(line: string): boolean {
	// Match task format: - [ ] or - [x] or - [X]
	// Allows leading whitespace for nested tasks
	return /^\s*-\s+\[([ xX])\]/.test(line);
}

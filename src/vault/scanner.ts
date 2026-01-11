/**
 * Vault scanner for discovering tasks in Obsidian vault
 * Based on tasks.md T033 specification
 */

import { Vault, TFile } from "obsidian";
import { Task } from "../types";
import { parseTaskLine } from "./taskParser";

/**
 * Scan the vault for all task items
 * @param vault The Obsidian vault instance
 * @returns Array of tasks found in the vault
 */
export async function scanVaultForTasks(vault: Vault): Promise<Task[]> {
	const tasks: Task[] = [];

	// Get all markdown files in the vault
	const markdownFiles = vault.getMarkdownFiles();

	for (const file of markdownFiles) {
		const fileTasks = await scanFileForTasks(vault, file);
		tasks.push(...fileTasks);
	}

	return tasks;
}

/**
 * Scan a single file for tasks
 * @param vault The Obsidian vault instance
 * @param file The file to scan
 * @returns Array of tasks found in the file
 */
async function scanFileForTasks(vault: Vault, file: TFile): Promise<Task[]> {
	const tasks: Task[] = [];

	try {
		// Read file content
		const content = await vault.read(file);
		const lines = content.split("\n");

		// Process each line
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line) continue; // Skip undefined/empty lines

			const lineNumber = i + 1; // Line numbers start at 1

			// Check if line contains a task marker (- [ ] or - [x] or - [X])
			if (isTaskLine(line)) {
				const taskResult = parseTaskLine(line, file.path, lineNumber);
				if (taskResult) {
					// DEBUG: Log the raw line and parsed task
					console.log(`Scanned task from ${file.path}:${lineNumber}`);
					console.log(`  Raw line: ${JSON.stringify(line)}`);
					console.log(`  Parsed description: ${JSON.stringify(taskResult.description)}`);
					console.log(`  Parsed status: ${taskResult.status}`);
					console.log(`  Parsed dueDate: ${taskResult.dueDate?.toISOString()}`);

					tasks.push(taskResult);
				}
			}
		}
	} catch (error) {
		console.error(`Error scanning file ${file.path}:`, error);
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

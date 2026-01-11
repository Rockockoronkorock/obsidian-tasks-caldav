/**
 * Date parsing utilities for Obsidian Tasks and CalDAV formats
 * Based on research.md decision: Native Date (no external dependencies)
 */

import { Task, TaskStatus } from "../types";
import { extractBlockId } from "./blockRefManager";

/**
 * Parse Tasks plugin date format: 📅 YYYY-MM-DD
 * @param line The task line to parse
 * @returns Date object or null if no date found
 */
export function parseTasksPluginDate(line: string): Date | null {
	const match = line.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
	if (!match) {
		return null;
	}

	// Parse as UTC date to avoid timezone issues
	return new Date(match[1] + 'T00:00:00Z');
}

/**
 * Format Date for CalDAV (ISO 8601 date-only format: YYYYMMDD)
 * @param date The date to format
 * @returns YYYYMMDD string
 */
export function toCalDAVDate(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');

	return `${year}${month}${day}`;
}

/**
 * Parse CalDAV date (supports both DATE and DATETIME formats)
 * @param isoString The CalDAV date string (YYYYMMDD or YYYYMMDDTHHMMSSZ)
 * @returns Date object or null if invalid
 */
export function parseCalDAVDate(isoString: string): Date | null {
	if (!isoString) {
		return null;
	}

	// Handle both DATE (YYYYMMDD) and DATETIME (YYYYMMDDTHHMMSSZ) formats
	const dateMatch = isoString.match(/^(\d{4})(\d{2})(\d{2})/);
	if (!dateMatch) {
		return null;
	}

	const [, year, month, day] = dateMatch;
	return new Date(`${year}-${month}-${day}T00:00:00Z`);
}

/**
 * Compare two dates for conflict resolution
 * @param date1 First date
 * @param date2 Second date
 * @returns true if date1 is newer than date2
 */
export function isNewer(date1: Date, date2: Date): boolean {
	return date1.getTime() > date2.getTime();
}

/**
 * Parse a task line to extract task properties
 * @param line The task line to parse
 * @param filePath The file path containing the task
 * @param lineNumber The line number in the file
 * @returns Task object or null if parsing failed
 */
export function parseTaskLine(line: string, filePath: string, lineNumber: number): Task | null {
	// Match task format: - [ ] or - [x] or - [X]
	const taskMatch = line.match(/^\s*-\s+\[([ xX])\]\s*(.*)$/);
	if (!taskMatch || !taskMatch[1] || !taskMatch[2]) {
		return null;
	}

	const statusChar = taskMatch[1];
	const content = taskMatch[2];

	// Determine status
	const status = statusChar === ' ' ? TaskStatus.Open : TaskStatus.Completed;

	// Extract block ID (if present)
	const blockId = extractBlockId(line) ?? '';

	// Extract due date
	const dueDate = parseTasksPluginDate(line);

	// Extract tags
	const tags = extractTags(content);

	// Extract description (remove date and block reference)
	const description = extractDescription(content);

	return {
		blockId,
		filePath,
		lineNumber,
		description,
		dueDate,
		status,
		rawLine: line,
		tags
	};
}

/**
 * Extract inline tags from task content
 * @param content The task content
 * @returns Array of tags (including # symbol)
 */
function extractTags(content: string): string[] {
	const tagMatches = content.matchAll(/#[\w-]+/g);
	return Array.from(tagMatches, match => match[0]);
}

/**
 * Extract clean description from task content
 * Removes date markers, completion dates, and block references
 * @param content The task content
 * @returns Clean description
 */
function extractDescription(content: string): string {
	// Remove due date marker (📅 YYYY-MM-DD)
	let description = content.replace(/📅\s*\d{4}-\d{2}-\d{2}/g, '');

	// Remove completion date marker (✅ YYYY-MM-DD)
	description = description.replace(/✅\s*\d{4}-\d{2}-\d{2}/g, '');

	// Remove block reference (^task-uuid)
	description = description.replace(/\s*\^task-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s*$/g, '');

	// Trim whitespace and collapse multiple spaces
	return description.replace(/\s+/g, ' ').trim();
}

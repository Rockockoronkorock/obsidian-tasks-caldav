/**
 * Date parsing utilities for Obsidian Tasks and CalDAV formats
 * Based on research.md decision: Native Date (no external dependencies)
 */

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

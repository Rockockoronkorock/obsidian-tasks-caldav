/**
 * VTODO format conversion utilities
 * Based on tasks.md T037 specification and contracts/caldav-api.md
 */

import { Task, TaskStatus, CalDAVTask, VTODOStatus } from "../types";
import { toCalDAVDate, parseCalDAVDate } from "../vault/taskParser";

/**
 * Convert an Obsidian Task to CalDAV VTODO format
 * @param task The Obsidian task
 * @returns Object with properties for CalDAV task creation
 */
export function taskToVTODO(task: Task): {
	summary: string;
	due: Date | null;
	status: VTODOStatus;
} {
	return {
		summary: task.description,
		due: task.dueDate,
		status: task.status === TaskStatus.Open ? VTODOStatus.NeedsAction : VTODOStatus.Completed
	};
}

/**
 * Convert CalDAV VTODO to Obsidian Task format
 * Note: This returns partial task data (missing vault-specific fields)
 * @param caldavTask The CalDAV task
 * @returns Partial task data for updating vault tasks
 */
export function vtodoToTask(caldavTask: CalDAVTask): {
	description: string;
	dueDate: Date | null;
	status: TaskStatus;
} {
	return {
		description: caldavTask.summary,
		dueDate: caldavTask.due,
		status: caldavTask.status === VTODOStatus.Completed ? TaskStatus.Completed : TaskStatus.Open
	};
}

/**
 * Build VTODO iCalendar string from task properties
 * @param uid Unique identifier
 * @param summary Task description
 * @param due Due date (optional)
 * @param status Task status
 * @returns iCalendar VTODO string
 */
export function buildVTODOString(
	uid: string,
	summary: string,
	due: Date | null,
	status: VTODOStatus
): string {
	const timestamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

	let vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Obsidian Tasks CalDAV Plugin//EN
BEGIN:VTODO
UID:${uid}
DTSTAMP:${timestamp}
SUMMARY:${summary}
STATUS:${status}`;

	if (due) {
		const dueString = toCalDAVDate(due);
		vtodoString += `\nDUE;VALUE=DATE:${dueString}`;
	}

	vtodoString += `
END:VTODO
END:VCALENDAR`;

	return vtodoString;
}

/**
 * Parse VTODO iCalendar string to extract task properties
 * @param vtodoData The VTODO iCalendar string
 * @returns Extracted task properties
 */
export function parseVTODOString(vtodoData: string): {
	uid: string;
	summary: string;
	due: Date | null;
	status: VTODOStatus;
	lastModified: Date;
} {
	// Extract UID
	const uidMatch = vtodoData.match(/UID:([^\r\n]+)/);
	const uid = uidMatch?.[1] ?? "";

	// Extract SUMMARY
	const summaryMatch = vtodoData.match(/SUMMARY:([^\r\n]+)/);
	const summary = summaryMatch?.[1] ?? "";

	// Extract DUE date
	const dueMatch = vtodoData.match(/DUE(?:;VALUE=DATE)?:(\d{8})/);
	const due = dueMatch && dueMatch[1] ? parseCalDAVDate(dueMatch[1]) : null;

	// Extract STATUS
	const statusMatch = vtodoData.match(/STATUS:([^\r\n]+)/);
	const statusStr = statusMatch?.[1] ?? "NEEDS-ACTION";
	const status = statusStr === "COMPLETED" ? VTODOStatus.Completed : VTODOStatus.NeedsAction;

	// Extract LAST-MODIFIED
	const lastModMatch = vtodoData.match(/LAST-MODIFIED:([^\r\n]+)/);
	const lastModified = lastModMatch && lastModMatch[1]
		? parseISODateTime(lastModMatch[1])
		: new Date();

	return {
		uid,
		summary,
		due,
		status,
		lastModified
	};
}

/**
 * Parse ISO datetime string (YYYYMMDDTHHMMSSZ) to Date
 * @param isoStr The ISO datetime string
 * @returns Date object
 */
function parseISODateTime(isoStr: string): Date {
	// Convert YYYYMMDDTHHMMSSZ to YYYY-MM-DDTHH:MM:SSZ
	const match = isoStr.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/);
	if (!match) {
		return new Date();
	}
	const [, year, month, day, hour, minute, second] = match;
	return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
}

/**
 * Escape text for iCalendar TEXT value type (RFC 5545 Section 3.3.11)
 * @param text The text to escape
 * @returns Escaped text safe for iCalendar properties
 */
export function escapeICalText(text: string): string {
	return text
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\n/g, "\\n");
}

/**
 * Unescape iCalendar TEXT value type back to plain text
 * @param text The escaped text
 * @returns Unescaped plain text
 */
export function unescapeICalText(text: string): string {
	return text
		.replace(/\\n/g, "\n")
		.replace(/\\,/g, ",")
		.replace(/\\;/g, ";")
		.replace(/\\\\/g, "\\");
}

/**
 * Format a Date object as CalDAV date-only string (YYYYMMDD)
 * @param date The date to format
 * @returns CalDAV date string
 */
export function formatDateForCalDAV(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}${month}${day}`;
}

/**
 * Update VTODO properties while preserving extended properties
 * T026 (002-sync-polish): Implements property preservation contract
 * @param existingVTODO Raw iCalendar string from CalDAV server
 * @param summary New task description
 * @param due New due date (or null to remove)
 * @param status New status
 * @returns Modified iCalendar string with preserved extended properties
 */
export function updateVTODOProperties(
	existingVTODO: string,
	summary: string,
	due: Date | null,
	status: VTODOStatus
): string {
	// T034: Debug logging for property preservation
	if (typeof console !== 'undefined' && console.log) {
		// Only log in debug builds - production builds will strip this
		const inputLength = existingVTODO.length;
		console.log(`[VTODO Update] Input length: ${inputLength} chars`);
	}

	let updated = existingVTODO;

	// Generate current timestamp in ISO 8601 format (YYYYMMDDTHHMMSSZ)
	const timestamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

	// 1. Replace SUMMARY property (always present)
	// Escape the summary text per iCalendar spec
	const escapedSummary = escapeICalText(summary);
	if (updated.match(/SUMMARY:[^\r\n]+/)) {
		updated = updated.replace(/SUMMARY:[^\r\n]+/, `SUMMARY:${escapedSummary}`);
	} else {
		// If SUMMARY is missing (malformed), insert before END:VTODO
		updated = updated.replace(/END:VTODO/, `SUMMARY:${escapedSummary}\r\nEND:VTODO`);
	}

	// 2. Replace STATUS property
	if (updated.match(/STATUS:[^\r\n]+/)) {
		updated = updated.replace(/STATUS:[^\r\n]+/, `STATUS:${status}`);
	} else {
		// If STATUS is missing, insert before END:VTODO
		updated = updated.replace(/END:VTODO/, `STATUS:${status}\r\nEND:VTODO`);
	}

	// 3. Handle DUE property (conditional)
	if (due) {
		const dueString = formatDateForCalDAV(due);
		const dueProperty = `DUE;VALUE=DATE:${dueString}`;

		// Match both DUE: and DUE;VALUE=DATE: formats
		if (updated.match(/DUE[;:][^\r\n]+/)) {
			updated = updated.replace(/DUE[;:][^\r\n]+/, dueProperty);
		} else {
			// If DUE is missing, insert before END:VTODO
			updated = updated.replace(/END:VTODO/, `${dueProperty}\r\nEND:VTODO`);
		}
	} else {
		// Remove DUE property if new value is null
		updated = updated.replace(/DUE[;:][^\r\n]+\r?\n?/, "");
	}

	// 4. Update LAST-MODIFIED timestamp
	if (updated.match(/LAST-MODIFIED:[^\r\n]+/)) {
		updated = updated.replace(/LAST-MODIFIED:[^\r\n]+/, `LAST-MODIFIED:${timestamp}`);
	} else {
		// If LAST-MODIFIED is missing, insert before END:VTODO
		updated = updated.replace(/END:VTODO/, `LAST-MODIFIED:${timestamp}\r\nEND:VTODO`);
	}

	// 5. Update DTSTAMP timestamp
	if (updated.match(/DTSTAMP:[^\r\n]+/)) {
		updated = updated.replace(/DTSTAMP:[^\r\n]+/, `DTSTAMP:${timestamp}`);
	} else {
		// If DTSTAMP is missing, insert before END:VTODO
		updated = updated.replace(/END:VTODO/, `DTSTAMP:${timestamp}\r\nEND:VTODO`);
	}

	// T031: Validate the result to ensure no property duplication
	try {
		validateVTODOStructure(updated);
	} catch (error) {
		// T032: If validation fails, log warning but return the result anyway
		// This allows for graceful degradation if we encounter unexpected formats
		if (error instanceof Error) {
			console.warn(`VTODO validation warning: ${error.message}`);
		}
	}

	// T034: Debug logging for output
	if (typeof console !== 'undefined' && console.log) {
		const outputLength = updated.length;
		console.log(`[VTODO Update] Output length: ${outputLength} chars`);
	}

	return updated;
}

/**
 * Validate VTODO structure to ensure no property duplication
 * T031 (002-sync-polish): Validation after property replacement
 * @param vtodo The VTODO iCalendar string to validate
 * @throws Error if validation fails
 */
function validateVTODOStructure(vtodo: string): void {
	// Check for required structure
	if (!vtodo.includes("BEGIN:VTODO")) {
		throw new Error("Missing BEGIN:VTODO");
	}
	if (!vtodo.includes("END:VTODO")) {
		throw new Error("Missing END:VTODO");
	}

	// Check for exactly one UID
	const uidMatches = vtodo.match(/UID:[^\r\n]+/g);
	if (!uidMatches || uidMatches.length === 0) {
		throw new Error("Missing UID property");
	}
	if (uidMatches.length > 1) {
		throw new Error(`Duplicate UID property (found ${uidMatches.length})`);
	}

	// Check for exactly one SUMMARY
	const summaryMatches = vtodo.match(/SUMMARY:[^\r\n]+/g);
	if (!summaryMatches || summaryMatches.length === 0) {
		throw new Error("Missing SUMMARY property");
	}
	if (summaryMatches.length > 1) {
		throw new Error(`Duplicate SUMMARY property (found ${summaryMatches.length})`);
	}

	// Check for exactly one STATUS
	const statusMatches = vtodo.match(/STATUS:[^\r\n]+/g);
	if (!statusMatches || statusMatches.length === 0) {
		throw new Error("Missing STATUS property");
	}
	if (statusMatches.length > 1) {
		throw new Error(`Duplicate STATUS property (found ${statusMatches.length})`);
	}

	// Check for at most one DUE
	const dueMatches = vtodo.match(/DUE[;:][^\r\n]+/g);
	if (dueMatches && dueMatches.length > 1) {
		throw new Error(`Duplicate DUE property (found ${dueMatches.length})`);
	}
}

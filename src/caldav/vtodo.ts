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

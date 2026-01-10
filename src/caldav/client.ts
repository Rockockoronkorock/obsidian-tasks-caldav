/**
 * CalDAV client wrapper using tsdav
 * Based on contracts/caldav-api.md specification
 */

import { DAVClient, DAVCalendar } from "tsdav";
import { CalDAVConfiguration, CalDAVTask, VTODOStatus } from "../types";
import { CalDAVError, CalDAVAuthError, CalDAVNetworkError } from "./errors";

/**
 * Minimal tsdav client interface for our needs
 */
interface MinimalDAVClient {
	fetchCalendars: () => Promise<DAVCalendar[]>;
	fetchCalendarObjects: (params: {
		calendar: DAVCalendar;
	}) => Promise<Array<{ url: string; data: string; etag?: string }>>;
	createCalendarObject: (params: {
		calendar: DAVCalendar;
		filename: string;
		iCalString: string;
	}) => Promise<{ url: string; etag?: string }>;
	updateCalendarObject: (params: {
		calendarObject: { url: string; data: string; etag: string };
	}) => Promise<{ url: string; etag?: string }>;
	deleteCalendarObject: (params: {
		calendarObject: { url: string; etag: string };
	}) => Promise<void>;
}

/**
 * CalDAV client for task synchronization
 */
export class CalDAVClient {
	private client: MinimalDAVClient | null = null;
	private calendar: DAVCalendar | null = null;
	private config: CalDAVConfiguration;

	constructor(config: CalDAVConfiguration) {
		this.config = config;
	}

	/**
	 * Connect to CalDAV server and initialize client
	 */
	async connect(): Promise<void> {
		try {
			// Create DAVClient
			const davClient = new DAVClient({
				serverUrl: this.config.serverUrl,
				credentials: {
					username: this.config.username,
					password: this.config.password,
				},
				authMethod: "Basic",
				defaultAccountType: "caldav",
			});

			// Login to establish auth
			await davClient.login();

			this.client = davClient as unknown as MinimalDAVClient;

			// Find the calendar by path
			const calendars = await this.client.fetchCalendars();

			// Try to match by calendar path or use first available calendar
			if (this.config.calendarPath && calendars) {
				this.calendar =
					calendars.find((cal) =>
						cal.url.includes(this.config.calendarPath)
					) ??
					calendars[0] ??
					null;
			} else if (calendars) {
				this.calendar = calendars[0] ?? null;
			}

			if (!this.calendar) {
				throw new CalDAVError("No calendar found on server");
			}
		} catch (error) {
			if (error instanceof Error) {
				console.error("CalDAV connection error:", error.message);
				// Check for authentication errors
				if (
					error.message.includes("401") ||
					error.message.includes("Unauthorized")
				) {
					throw new CalDAVAuthError(
						"Authentication failed. Please check your credentials."
					);
				}
				// Check for network errors
				if (
					error.message.includes("ENOTFOUND") ||
					error.message.includes("ECONNREFUSED") ||
					error.message.includes("Network")
				) {
					throw new CalDAVNetworkError(
						"Network error. Please check your server URL and internet connection."
					);
				}
			}
			throw error;
		}
	}

	/**
	 * Disconnect from CalDAV server
	 */
	async disconnect(): Promise<void> {
		this.client = null;
		this.calendar = null;
	}

	/**
	 * Test connection to CalDAV server
	 * @returns true if connection successful
	 */
	async testConnection(): Promise<boolean> {
		try {
			await this.connect();
			await this.disconnect();
			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Fetch all tasks from CalDAV server
	 * @returns Array of CalDAV tasks
	 */
	async fetchAllTasks(): Promise<CalDAVTask[]> {
		if (!this.client || !this.calendar) {
			throw new CalDAVError(
				"Client not connected. Call connect() first."
			);
		}

		try {
			const calendarObjects = await this.client.fetchCalendarObjects({
				calendar: this.calendar,
			});

			// Filter only VTODO objects
			const todoObjects = calendarObjects.filter((obj) =>
				obj.data.includes("BEGIN:VTODO")
			);

			return todoObjects.map((obj) => this.parseVTODOToTask(obj));
		} catch (error) {
			if (error instanceof Error) {
				throw new CalDAVError(
					`Failed to fetch tasks: ${error.message}`
				);
			}
			throw error;
		}
	}

	/**
	 * Create a task on CalDAV server
	 * @param task The task data
	 * @returns Created CalDAV task with UID and etag
	 */
	async createTask(
		summary: string,
		due: Date | null,
		status: VTODOStatus
	): Promise<CalDAVTask> {
		if (!this.client || !this.calendar) {
			throw new CalDAVError(
				"Client not connected. Call connect() first."
			);
		}

		const uid = crypto.randomUUID();
		const timestamp =
			new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

		let vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Obsidian Tasks CalDAV Plugin//EN
BEGIN:VTODO
UID:${uid}
DTSTAMP:${timestamp}
SUMMARY:${summary}
STATUS:${status}`;

		if (due) {
			const dueString = this.formatDateForCalDAV(due);
			vtodoString += `\nDUE;VALUE=DATE:${dueString}`;
		}

		vtodoString += `
END:VTODO
END:VCALENDAR`;

		try {
			const result = await this.client.createCalendarObject({
				calendar: this.calendar,
				filename: `${uid}.ics`,
				iCalString: vtodoString,
			});

			return {
				uid,
				summary,
				due,
				status,
				lastModified: new Date(),
				etag: result.etag ?? "",
				href: result.url,
			};
		} catch (error) {
			if (error instanceof Error) {
				throw new CalDAVError(
					`Failed to create task: ${error.message}`
				);
			}
			throw error;
		}
	}

	/**
	 * Update a task on CalDAV server
	 * @param caldavUid The CalDAV UID
	 * @param summary Task summary
	 * @param due Due date
	 * @param status Task status
	 * @param etag Current ETag for optimistic locking
	 * @returns Updated CalDAV task
	 */
	async updateTask(
		caldavUid: string,
		summary: string,
		due: Date | null,
		status: VTODOStatus,
		etag: string,
		href: string
	): Promise<CalDAVTask> {
		if (!this.client || !this.calendar) {
			throw new CalDAVError(
				"Client not connected. Call connect() first."
			);
		}

		const timestamp =
			new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

		let vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Obsidian Tasks CalDAV Plugin//EN
BEGIN:VTODO
UID:${caldavUid}
DTSTAMP:${timestamp}
SUMMARY:${summary}
STATUS:${status}
LAST-MODIFIED:${timestamp}`;

		if (due) {
			const dueString = this.formatDateForCalDAV(due);
			vtodoString += `\nDUE;VALUE=DATE:${dueString}`;
		}

		vtodoString += `
END:VTODO
END:VCALENDAR`;

		try {
			const result = await this.client.updateCalendarObject({
				calendarObject: {
					url: href,
					data: vtodoString,
					etag,
				},
			});

			return {
				uid: caldavUid,
				summary,
				due,
				status,
				lastModified: new Date(),
				etag: result.etag ?? etag,
				href,
			};
		} catch (error) {
			if (error instanceof Error) {
				throw new CalDAVError(
					`Failed to update task: ${error.message}`
				);
			}
			throw error;
		}
	}

	/**
	 * Delete a task from CalDAV server
	 * @param caldavUid The CalDAV UID
	 * @param etag Current ETag
	 * @param href Resource URL
	 */
	async deleteTask(
		caldavUid: string,
		etag: string,
		href: string
	): Promise<void> {
		if (!this.client || !this.calendar) {
			throw new CalDAVError(
				"Client not connected. Call connect() first."
			);
		}

		try {
			await this.client.deleteCalendarObject({
				calendarObject: {
					url: href,
					etag,
				},
			});
		} catch (error) {
			if (error instanceof Error) {
				throw new CalDAVError(
					`Failed to delete task: ${error.message}`
				);
			}
			throw error;
		}
	}

	/**
	 * Parse a VTODO calendar object to CalDAVTask format
	 */
	private parseVTODOToTask(obj: {
		url: string;
		data: string;
		etag?: string;
	}): CalDAVTask {
		const data = obj.data;

		// Extract UID
		const uidMatch = data.match(/UID:([^\r\n]+)/);
		const uid = uidMatch?.[1] ?? "";

		// Extract SUMMARY
		const summaryMatch = data.match(/SUMMARY:([^\r\n]+)/);
		const summary = summaryMatch?.[1] ?? "";

		// Extract DUE date
		const dueMatch = data.match(/DUE(?:;VALUE=DATE)?:(\d{8})/);
		const due =
			dueMatch && dueMatch[1]
				? this.parseDateFromCalDAV(dueMatch[1])
				: null;

		// Extract STATUS
		const statusMatch = data.match(/STATUS:([^\r\n]+)/);
		const statusStr = statusMatch?.[1] ?? "NEEDS-ACTION";
		const status =
			statusStr === "COMPLETED"
				? VTODOStatus.Completed
				: VTODOStatus.NeedsAction;

		// Extract LAST-MODIFIED
		const lastModMatch = data.match(/LAST-MODIFIED:([^\r\n]+)/);
		const lastModified =
			lastModMatch && lastModMatch[1]
				? new Date(this.parseISODateTime(lastModMatch[1]))
				: new Date();

		return {
			uid,
			summary,
			due,
			status,
			lastModified,
			etag: obj.etag ?? "",
			href: obj.url,
		};
	}

	/**
	 * Format Date for CalDAV (YYYYMMDD)
	 */
	private formatDateForCalDAV(date: Date): string {
		const year = date.getUTCFullYear();
		const month = String(date.getUTCMonth() + 1).padStart(2, "0");
		const day = String(date.getUTCDate()).padStart(2, "0");
		return `${year}${month}${day}`;
	}

	/**
	 * Parse CalDAV date string (YYYYMMDD) to Date
	 */
	private parseDateFromCalDAV(dateStr: string): Date {
		const year = dateStr.substring(0, 4);
		const month = dateStr.substring(4, 6);
		const day = dateStr.substring(6, 8);
		return new Date(`${year}-${month}-${day}T00:00:00Z`);
	}

	/**
	 * Parse ISO datetime string (YYYYMMDDTHHMMSSZ) to ISO 8601
	 */
	private parseISODateTime(isoStr: string): string {
		// Convert YYYYMMDDTHHMMSSZ to YYYY-MM-DDTHH:MM:SSZ
		const match = isoStr.match(
			/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/
		);
		if (!match) {
			return new Date().toISOString();
		}
		const [, year, month, day, hour, minute, second] = match;
		return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
	}
}

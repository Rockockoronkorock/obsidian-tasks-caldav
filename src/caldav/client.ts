/**
 * CalDAV client wrapper using tsdav
 * Based on contracts/caldav-api.md specification
 * Implements T072: Comprehensive error handling
 * Implements T073: Retry logic with exponential backoff
 */

import { DAVClient, DAVCalendar } from "tsdav";
import { CalDAVConfiguration, CalDAVTask, VTODOStatus } from "../types";
import {
	CalDAVError,
	CalDAVAuthError,
	CalDAVNetworkError,
	CalDAVConflictError,
	CalDAVServerError,
	CalDAVTimeoutError,
	CalDAVRateLimitError,
} from "./errors";
import { withRetry } from "./retry";
import { Logger } from "../sync/logger";
import { updateVTODOProperties, escapeICalText } from "./vtodo";

/**
 * Minimal tsdav client interface for our needs
 */
interface MinimalDAVClient {
	fetchCalendars: () => Promise<DAVCalendar[]>;
	fetchCalendarObjects: (params: {
		calendar: DAVCalendar;
		filters?: any; // Custom filters for VTODO, VEVENT, etc.
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
	 * Implements T073: Retry logic with exponential backoff
	 */
	async connect(): Promise<void> {
		return withRetry(async () => {
			try {
				Logger.debug("Connecting to CalDAV server...");

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

				Logger.debug(
					`Found ${calendars?.length ?? 0} calendars on server`
				);

				// Try to match by calendar path or use first available calendar
				if (this.config.calendarPath && calendars) {
					this.calendar =
						calendars.find((cal) =>
							cal.url.includes(this.config.calendarPath)
						) ??
						calendars[0] ??
						null;

					Logger.debug(
						`Selected calendar by path "${this.config.calendarPath}": ${this.calendar?.url}`
					);
				} else if (calendars) {
					this.calendar = calendars[0] ?? null;
					Logger.debug(
						`Selected first available calendar: ${this.calendar?.url}`
					);
				}

				if (!this.calendar) {
					throw new CalDAVError("No calendar found on server");
				}

				Logger.info(
					`Connected to CalDAV calendar: ${
						this.calendar.displayName ?? this.calendar.url
					}`
				);
			} catch (error) {
				// Transform error into appropriate CalDAV error type
				throw this.handleConnectionError(error);
			}
		});
	}

	/**
	 * Handle connection errors and convert to appropriate CalDAV error types
	 * Implements T072: Comprehensive error handling
	 */
	private handleConnectionError(error: unknown): Error {
		if (error instanceof CalDAVError) {
			return error; // Already a CalDAV error, pass through
		}

		if (error instanceof Error) {
			const message = error.message;

			// Check for authentication errors
			if (message.includes("401") || message.includes("Unauthorized")) {
				return new CalDAVAuthError(
					"Authentication failed. Please check your credentials."
				);
			}

			// Check for network errors - connection refused
			if (
				message.includes("ERR_CONNECTION_REFUSED") ||
				message.includes("ECONNREFUSED")
			) {
				return new CalDAVNetworkError(
					`Cannot connect to server at ${this.config.serverUrl}. ` +
						"Please ensure the CalDAV server is running and accessible."
				);
			}

			// Check for timeout errors
			if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
				return new CalDAVTimeoutError(
					"Connection timed out. Please check your server URL and internet connection."
				);
			}

			// Check for other network errors
			if (message.includes("ENOTFOUND") || message.includes("Network")) {
				return new CalDAVNetworkError(
					"Network error. Please check your server URL and internet connection."
				);
			}

			// Check for server errors
			if (message.includes("500") || message.includes("503")) {
				const statusMatch = message.match(/(\d{3})/);
				const statusCode =
					statusMatch && statusMatch[1]
						? parseInt(statusMatch[1])
						: 500;
				return new CalDAVServerError(
					`Server error: ${message}`,
					statusCode
				);
			}

			// Generic CalDAV error
			return new CalDAVError(`Connection failed: ${message}`);
		}

		// Unknown error type
		return new CalDAVError(`Unknown connection error: ${String(error)}`);
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
	 * Implements T073: Retry logic with exponential backoff
	 * @param completedTaskAgeThreshold Optional date threshold to exclude old completed tasks at server level
	 * @returns Array of CalDAV tasks
	 */
	async fetchAllTasks(
		completedTaskAgeThreshold?: Date
	): Promise<CalDAVTask[]> {
		if (!this.client || !this.calendar) {
			throw new CalDAVError(
				"Client not connected. Call connect() first."
			);
		}

		return withRetry(async () => {
			try {
				Logger.debug("Fetching tasks from CalDAV server...");

				// Create filter for VTODO items (tasks) instead of default VEVENT (events)
				let vtodoFilter: any = {
					"comp-filter": {
						_attributes: { name: "VCALENDAR" },
						"comp-filter": {
							_attributes: { name: "VTODO" },
						},
					},
				};

				// If age threshold is provided, add time-range filter to exclude old completed tasks
				if (
					completedTaskAgeThreshold &&
					completedTaskAgeThreshold.getTime() !== 0
				) {
					const thresholdStr = this.formatDateTimeForCalDAV(
						completedTaskAgeThreshold
					);

					vtodoFilter["comp-filter"]["comp-filter"]["prop-filter"] = {
						_attributes: { name: "LAST-MODIFIED" },
						"time-range": {
							_attributes: {
								start: thresholdStr,
							},
						},
					};

					Logger.debug(
						`Applying server-side filter: excluding tasks older than ${completedTaskAgeThreshold.toISOString()}`
					);
				}

				// Fetch calendar objects with VTODO filter
				const calendarObjects = await this.client!.fetchCalendarObjects(
					{
						calendar: this.calendar!,
						filters: vtodoFilter,
					}
				);

				Logger.debug(
					`Fetched ${
						calendarObjects?.length ?? 0
					} calendar objects from server`
				);

				// Check if we got any objects
				if (!calendarObjects || calendarObjects.length === 0) {
					Logger.debug(
						"No VTODO objects found on server (calendar may be empty)"
					);
					return [];
				}

				// Filter for VTODO objects
				const todoObjects = calendarObjects.filter((obj) => {
					const hasVTODO =
						obj.data && obj.data.includes("BEGIN:VTODO");
					if (!hasVTODO) {
						Logger.warn(
							`Object fetched with VTODO filter doesn't contain VTODO: ${obj.url}`
						);
					}
					return hasVTODO;
				});

				Logger.debug(`Found ${todoObjects.length} VTODO objects`);

				return todoObjects.map((obj) => this.parseVTODOToTask(obj));
			} catch (error) {
				throw this.handleNetworkError(error, "fetch tasks");
			}
		});
	}

	/**
	 * Handle network errors and convert to appropriate CalDAV error types
	 * Implements T072: Comprehensive error handling
	 */
	private handleNetworkError(error: unknown, operation: string): Error {
		if (error instanceof CalDAVError) {
			return error; // Already a CalDAV error
		}

		if (error instanceof Error) {
			const message = error.message;

			// Check for timeout
			if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
				return new CalDAVTimeoutError(
					`Timeout while trying to ${operation}`
				);
			}

			// Check for network errors
			if (
				message.includes("Network") ||
				message.includes("ECONNREFUSED") ||
				message.includes("ENOTFOUND")
			) {
				return new CalDAVNetworkError(
					`Network error while trying to ${operation}: ${message}`
				);
			}

			// Check for server errors
			if (message.includes("500") || message.includes("503")) {
				const statusMatch = message.match(/(\d{3})/);
				const statusCode =
					statusMatch && statusMatch[1]
						? parseInt(statusMatch[1])
						: 500;
				return new CalDAVServerError(
					`Server error while trying to ${operation}: ${message}`,
					statusCode
				);
			}

			// Check for auth errors
			if (
				message.includes("401") ||
				message.includes("403") ||
				message.includes("Unauthorized")
			) {
				return new CalDAVAuthError(
					`Authentication failed while trying to ${operation}`
				);
			}

			// Generic error
			return new CalDAVError(`Failed to ${operation}: ${message}`);
		}

		return new CalDAVError(
			`Unknown error while trying to ${operation}: ${String(error)}`
		);
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

		// T035: Escape summary text per iCalendar spec
		const escapedSummary = escapeICalText(summary);

		let vtodoString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Obsidian Tasks CalDAV Plugin//EN
BEGIN:VTODO
UID:${uid}
DTSTAMP:${timestamp}
SUMMARY:${escapedSummary}
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

		// DEBUG
		console.log("=== CalDAV Update Debug ===");
		console.log("Updating task:", caldavUid);
		console.log("Summary:", summary);
		console.log("Status:", status);
		console.log("Due:", due?.toISOString());
		console.log("ETag:", etag);
		console.log("URL:", href);
		console.log("VTODO data:");
		console.log(vtodoString);
		console.log("===========================");

		try {
			const result = await this.client.updateCalendarObject({
				calendarObject: {
					url: href,
					data: vtodoString,
					etag,
				},
			});

			// DEBUG
			console.log("Update result:", result);

			let newEtag = result.etag;

			// If the server didn't return a new etag (common CalDAV behavior),
			// we need to fetch the task to get the fresh etag
			if (!newEtag) {
				Logger.debug(
					"Server did not return etag in update response, fetching fresh etag..."
				);
				const freshTask = await this.fetchTaskByUid(caldavUid);
				if (freshTask) {
					newEtag = freshTask.etag;
					Logger.debug(`Fetched fresh etag: ${newEtag}`);
				} else {
					Logger.warn(
						`Could not fetch fresh etag for task ${caldavUid}, using old etag`
					);
					newEtag = etag;
				}
			}

			return {
				uid: caldavUid,
				summary,
				due,
				status,
				lastModified: new Date(),
				etag: newEtag,
				href,
			};
		} catch (error) {
			console.error("CalDAV update error:", error);

			if (error instanceof Error) {
				console.error("Error details:", {
					message: error.message,
					stack: error.stack,
					name: error.name,
				});

				// T049: Handle 412 Precondition Failed (ETag conflict)
				if (
					error.message.includes("412") ||
					error.message.includes("Precondition Failed")
				) {
					throw new CalDAVConflictError(
						`Task was modified on server. Please sync again to get latest version.`,
						etag
					);
				}

				// Handle connection errors during update
				if (
					error.message.includes("ERR_CONNECTION_REFUSED") ||
					error.message.includes("ECONNREFUSED")
				) {
					throw new CalDAVNetworkError(
						`Cannot reach CalDAV server to update task. Server may be offline.`
					);
				}

				throw new CalDAVError(
					`Failed to update task: ${error.message}`
				);
			}
			throw error;
		}
	}

	/**
	 * Update a task while preserving extended CalDAV properties
	 * T028 (002-sync-polish): Read-before-update pattern for property preservation
	 * @param caldavUid The CalDAV UID
	 * @param summary New task description
	 * @param due New due date (or null)
	 * @param status New status
	 * @param etag Current ETag for optimistic locking
	 * @param href Resource URL
	 * @returns Updated CalDAV task
	 */
	async updateTaskWithPreservation(
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

		try {
			// T027: Fetch the existing raw VTODO data
			const existingVTODO = await this.fetchTaskRawData(caldavUid);

			if (!existingVTODO) {
				throw new CalDAVError(
					`Task with UID ${caldavUid} not found on server. It may have been deleted.`
				);
			}

			Logger.debug(`Updating task ${caldavUid} with property preservation`);

			// T026: Update only managed properties, preserving everything else
			const updatedVTODO = updateVTODOProperties(
				existingVTODO,
				summary,
				due,
				status
			);

			// Send the modified VTODO back to the server
			const result = await this.client.updateCalendarObject({
				calendarObject: {
					url: href,
					data: updatedVTODO,
					etag,
				},
			});

			let newEtag = result.etag;

			// If the server didn't return a new etag, fetch it
			if (!newEtag) {
				Logger.debug(
					"Server did not return etag in update response, fetching fresh etag..."
				);
				const freshTask = await this.fetchTaskByUid(caldavUid);
				if (freshTask) {
					newEtag = freshTask.etag;
					Logger.debug(`Fetched fresh etag: ${newEtag}`);
				} else {
					Logger.warn(
						`Could not fetch fresh etag for task ${caldavUid}, using old etag`
					);
					newEtag = etag;
				}
			}

			Logger.debug(`Task ${caldavUid} updated successfully with preserved properties`);

			return {
				uid: caldavUid,
				summary,
				due,
				status,
				lastModified: new Date(),
				etag: newEtag,
				href,
			};
		} catch (error) {
			if (error instanceof Error) {
				// Handle 412 Precondition Failed (ETag conflict)
				if (
					error.message.includes("412") ||
					error.message.includes("Precondition Failed")
				) {
					throw new CalDAVConflictError(
						`Task was modified on server. Please sync again to get latest version.`,
						etag
					);
				}

				// Handle connection errors
				if (
					error.message.includes("ERR_CONNECTION_REFUSED") ||
					error.message.includes("ECONNREFUSED")
				) {
					throw new CalDAVNetworkError(
						`Cannot reach CalDAV server to update task. Server may be offline.`
					);
				}

				throw new CalDAVError(
					`Failed to update task with preservation: ${error.message}`
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
	 * Fetch a single task by UID to get fresh metadata (especially etag)
	 * This is useful after updates when the server doesn't return the new etag
	 * @param uid The CalDAV UID of the task
	 * @returns The task with fresh metadata, or null if not found
	 */
	async fetchTaskByUid(uid: string): Promise<CalDAVTask | null> {
		if (!this.client || !this.calendar) {
			throw new CalDAVError(
				"Client not connected. Call connect() first."
			);
		}

		try {
			// Fetch all tasks and find the one with matching UID
			// This is not the most efficient but it's reliable
			const calendarObjects = await this.client.fetchCalendarObjects({
				calendar: this.calendar,
				filters: {
					"comp-filter": {
						_attributes: { name: "VCALENDAR" },
						"comp-filter": {
							_attributes: { name: "VTODO" },
						},
					},
				},
			});

			if (!calendarObjects) {
				return null;
			}

			// Find the task with matching UID
			for (const obj of calendarObjects) {
				if (obj.data && obj.data.includes(`UID:${uid}`)) {
					return this.parseVTODOToTask(obj);
				}
			}

			return null;
		} catch (error) {
			Logger.warn(
				`Failed to fetch task by UID ${uid}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			return null;
		}
	}

	/**
	 * Fetch the raw iCalendar VTODO data for a task
	 * T027 (002-sync-polish): Used for property preservation
	 * @param uid The CalDAV UID of the task
	 * @returns The raw VTODO iCalendar string, or null if not found
	 */
	async fetchTaskRawData(uid: string): Promise<string | null> {
		if (!this.client || !this.calendar) {
			throw new CalDAVError(
				"Client not connected. Call connect() first."
			);
		}

		try {
			// Fetch all tasks and find the one with matching UID
			const calendarObjects = await this.client.fetchCalendarObjects({
				calendar: this.calendar,
				filters: {
					"comp-filter": {
						_attributes: { name: "VCALENDAR" },
						"comp-filter": {
							_attributes: { name: "VTODO" },
						},
					},
				},
			});

			if (!calendarObjects) {
				return null;
			}

			// Find the task with matching UID and return raw data
			for (const obj of calendarObjects) {
				if (obj.data && obj.data.includes(`UID:${uid}`)) {
					Logger.debug(`Fetched raw VTODO data for UID ${uid}`);
					return obj.data;
				}
			}

			Logger.debug(`Task with UID ${uid} not found on server`);
			return null;
		} catch (error) {
			Logger.warn(
				`Failed to fetch raw VTODO data for UID ${uid}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			return null;
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

		// Extract DUE date - handles multiple iCalendar formats:
		// - DUE:YYYYMMDD (date only)
		// - DUE;VALUE=DATE:YYYYMMDD (explicit date)
		// - DUE:YYYYMMDDTHHMMSSZ (UTC datetime)
		// - DUE:YYYYMMDDTHHMMSS (floating datetime)
		// - DUE;TZID=...:YYYYMMDDTHHMMSS (datetime with timezone)
		const dueMatch = data.match(/DUE(?:;[^:]+)?:(\d{8})(?:T(\d{6}))?Z?/);
		let due: Date | null = null;
		if (dueMatch && dueMatch[1]) {
			const dateStr = dueMatch[1];
			const timeStr = dueMatch[2]; // may be undefined for date-only
			due = this.parseDateTimeFromCalDAV(dateStr, timeStr);
		}

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
	 * Format DateTime for CalDAV filters (YYYYMMDDTHHMMSSZ)
	 */
	private formatDateTimeForCalDAV(date: Date): string {
		const year = date.getUTCFullYear();
		const month = String(date.getUTCMonth() + 1).padStart(2, "0");
		const day = String(date.getUTCDate()).padStart(2, "0");
		const hour = String(date.getUTCHours()).padStart(2, "0");
		const minute = String(date.getUTCMinutes()).padStart(2, "0");
		const second = String(date.getUTCSeconds()).padStart(2, "0");
		return `${year}${month}${day}T${hour}${minute}${second}Z`;
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
	 * Parse CalDAV date/datetime to Date
	 * @param dateStr Date portion (YYYYMMDD)
	 * @param timeStr Optional time portion (HHMMSS)
	 * @returns Date object
	 */
	private parseDateTimeFromCalDAV(dateStr: string, timeStr?: string): Date {
		const year = dateStr.substring(0, 4);
		const month = dateStr.substring(4, 6);
		const day = dateStr.substring(6, 8);

		if (timeStr) {
			const hour = timeStr.substring(0, 2);
			const minute = timeStr.substring(2, 4);
			const second = timeStr.substring(4, 6);
			// Note: We treat timezone-specified times as local time for simplicity.
			// A more complete implementation would use the VTIMEZONE to convert.
			return new Date(
				`${year}-${month}-${day}T${hour}:${minute}:${second}`
			);
		}

		// Date-only: return midnight UTC
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

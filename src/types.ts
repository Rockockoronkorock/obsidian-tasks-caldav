/**
 * Core type definitions for CalDAV Task Synchronization plugin
 * Based on data-model.md from feature specification
 */

/**
 * Task status enumeration
 */
export enum TaskStatus {
	Open = "open",
	Completed = "completed"
}

/**
 * CalDAV VTODO status enumeration
 */
export enum VTODOStatus {
	NeedsAction = "NEEDS-ACTION",
	Completed = "COMPLETED"
}

/**
 * Represents a task item found in the Obsidian vault
 */
export interface Task {
	/** Stable unique identifier (UUID v4 format: task-[uuid]) */
	blockId: string;
	/** Vault-relative path to the markdown file containing this task */
	filePath: string;
	/** Line number where the task appears in the file */
	lineNumber: number;
	/** Text content of the task */
	description: string;
	/** Optional due date (parsed from 📅 YYYY-MM-DD format) */
	dueDate: Date | null;
	/** Completion status (open or completed) */
	status: TaskStatus;
	/** Original markdown line for reconstruction */
	rawLine: string;
	/** Inline tags extracted from the task line (e.g., #work, #personal) */
	tags: string[];
}

/**
 * Represents the bidirectional link between an Obsidian task and a CalDAV VTODO item
 */
export interface SyncMapping {
	/** Reference to the Obsidian task's block ID */
	blockId: string;
	/** Unique identifier of the VTODO on the CalDAV server */
	caldavUid: string;
	/** When this task was last synchronized */
	lastSyncTimestamp: Date;
	/** Hash of task content at last sync (for change detection) */
	lastKnownContentHash: string;
	/** Last modification timestamp from Obsidian */
	lastKnownObsidianModified: Date;
	/** Last modification timestamp from CalDAV server */
	lastKnownCalDAVModified: Date;
}

/**
 * User-provided settings for connecting to the CalDAV server
 */
export interface CalDAVConfiguration {
	/** Base URL of the CalDAV server (must be HTTPS) */
	serverUrl: string;
	/** Username for authentication */
	username: string;
	/** Password or app-specific token */
	password: string;
	/** Path to the calendar on the server */
	calendarPath: string;
	/** Automatic sync interval in seconds (default: 60) */
	syncInterval: number;
	/** Whether automatic background sync is enabled (default: true) */
	enableAutoSync: boolean;
	/** List of vault folder paths to exclude from sync */
	excludedFolders: string[];
	/** List of inline tags to exclude from sync */
	excludedTags: string[];
	/** Age threshold in days for completed tasks (default: 30) */
	completedTaskAgeDays: number;
}

/**
 * Represents a VTODO item on the CalDAV server
 */
export interface CalDAVTask {
	/** Unique identifier on CalDAV server */
	uid: string;
	/** Task description (maps to Obsidian task description) */
	summary: string;
	/** Due date (maps to Obsidian task dueDate) */
	due: Date | null;
	/** CalDAV status: "NEEDS-ACTION" or "COMPLETED" */
	status: VTODOStatus;
	/** LAST-MODIFIED timestamp from CalDAV */
	lastModified: Date;
	/** ETag from CalDAV server (for optimistic concurrency) */
	etag: string;
	/** Full URL to this VTODO resource on the server */
	href: string;
}

/**
 * Serializable format for sync mapping storage in plugin data.json
 */
export interface SerializedSyncMapping {
	blockId: string;
	caldavUid: string;
	lastSyncTimestamp: string;
	lastKnownContentHash: string;
	lastKnownObsidianModified: string;
	lastKnownCalDAVModified: string;
}

/**
 * Plugin data structure for persistence
 */
export interface PluginData {
	version: number;
	settings: CalDAVConfiguration;
	syncState: {
		mappings: Record<string, SerializedSyncMapping>;
	};
}

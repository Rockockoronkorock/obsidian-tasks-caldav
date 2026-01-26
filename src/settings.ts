import { CalDAVConfiguration } from "./types";

/**
 * Default settings for CalDAV Task Synchronization
 * Based on data-model.md specification
 * Note: Password is stored separately using Obsidian's SecretStorage API
 */
export const DEFAULT_SETTINGS: CalDAVConfiguration = {
	// Connection settings
	serverUrl: "",
	username: "",
	password: "",
	calendarPath: "",

	// Sync settings
	syncInterval: 60, // seconds
	enableAutoSync: false,

	// Filter settings
	excludedFolders: [],
	excludedTags: [],
	completedTaskAgeDays: 30,

	// Logging settings
	enableDebugLogging: false,
};

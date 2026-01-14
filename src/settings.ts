import { CalDAVConfiguration } from './types';

/**
 * Default settings for CalDAV Task Synchronization
 * Based on data-model.md specification
 */
export const DEFAULT_SETTINGS: CalDAVConfiguration = {
	// Connection settings
	serverUrl: '',
	username: '',
	password: '',
	calendarPath: '',

	// Sync settings
	syncInterval: 60, // seconds
	enableAutoSync: true,

	// Filter settings
	excludedFolders: [],
	excludedTags: [],
	completedTaskAgeDays: 30,

	// Logging settings
	enableDebugLogging: false
};

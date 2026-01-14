/**
 * Logging utility for sync operations
 * Implements T076: Add detailed logging throughout sync process
 */

// Global debug flag - can be toggled via settings or environment
let DEBUG = false;

/**
 * Enable or disable debug logging
 */
export function setDebugMode(enabled: boolean): void {
	DEBUG = enabled;
}

/**
 * Centralized logger for sync operations
 * Provides structured logging with different levels
 */
export class Logger {
	/**
	 * Log an informational message
	 */
	static info(message: string, ...args: unknown[]): void {
		console.log(`[CalDAV Sync] ${message}`, ...args);
	}

	/**
	 * Log a warning message
	 */
	static warn(message: string, ...args: unknown[]): void {
		console.warn(`[CalDAV Sync] ${message}`, ...args);
	}

	/**
	 * Log an error message
	 */
	static error(message: string, error?: Error | unknown): void {
		if (error) {
			console.error(`[CalDAV Sync] ${message}`, error);
		} else {
			console.error(`[CalDAV Sync] ${message}`);
		}
	}

	/**
	 * Log debug information (only when debug mode is enabled)
	 */
	static debug(message: string, ...args: unknown[]): void {
		if (DEBUG) {
			console.log(`[CalDAV Sync DEBUG] ${message}`, ...args);
		}
	}

	/**
	 * Log task processing information
	 */
	static taskInfo(blockId: string, message: string): void {
		Logger.debug(`Task ${blockId}: ${message}`);
	}

	/**
	 * Log sync statistics
	 */
	static syncStats(stats: {
		total: number;
		synced: number;
		filtered: number;
		errors: number;
	}): void {
		Logger.info(
			`Sync stats: ${stats.synced}/${stats.total} tasks synced, ${stats.filtered} filtered, ${stats.errors} errors`
		);
	}

	/**
	 * Log sync start (INFO level - always shown)
	 */
	static syncStart(): void {
		Logger.info("Sync started...");
	}

	/**
	 * Log sync completion (INFO level - always shown)
	 */
	static syncComplete(): void {
		Logger.info("Sync completed.");
	}
}

/**
 * Sync scheduler for automatic synchronization
 * Implements US5: T027-T030
 * Implements T075: Automatic retry on next interval after sync failure
 */

import { App } from 'obsidian';
import { CalDAVConfiguration } from '../types';
import { showSyncStart, showSyncSuccess, showSyncError } from '../ui/notifications';
import { Logger } from './logger';

/**
 * Callback type for sync operations
 * @param isAutoSync Whether this is an automatic sync (T015, 002-sync-polish)
 */
export type SyncCallback = (isAutoSync: boolean) => Promise<number>;

/**
 * Manages automatic sync scheduling and manual triggers
 * Implements T075: Automatic retry on next interval
 */
export class SyncScheduler {
	private intervalId: number | null = null;
	private config: CalDAVConfiguration;
	private syncCallback: SyncCallback;
	private isRunning: boolean = false;
	private app: App;
	private consecutiveFailures: number = 0;
	private lastSyncTime: Date | null = null;
	private lastErrorMessage: string | null = null;

	constructor(app: App, config: CalDAVConfiguration, syncCallback: SyncCallback) {
		this.app = app;
		this.config = config;
		this.syncCallback = syncCallback;
	}

	/**
	 * Start automatic sync with configured interval
	 */
	start(): void {
		if (!this.config.enableAutoSync) {
			return;
		}

		if (this.intervalId !== null) {
			this.stop();
		}

		// Start periodic sync
		this.intervalId = window.setInterval(
			() => {
				void this.performSync(true);
			},
			this.config.syncInterval * 1000
		);

		this.isRunning = true;
		Logger.info(`Sync scheduler started with ${this.config.syncInterval}s interval`);
	}

	/**
	 * Stop automatic sync
	 */
	stop(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}

		this.isRunning = false;
		Logger.info('Sync scheduler stopped');
	}

	/**
	 * Reset the sync timer (restart the interval)
	 * Used when manual sync is triggered to reset automatic timer
	 */
	reset(): void {
		if (this.isRunning && this.config.enableAutoSync) {
			this.stop();
			this.start();
		}
	}

	/**
	 * Perform a manual sync operation
	 * Resets the automatic sync timer after completion
	 */
	async manualSync(): Promise<void> {
		await this.performSync(false);
		this.reset(); // Reset timer after manual sync
	}

	/**
	 * Perform sync operation with notifications
	 * Implements T075: Automatic retry on next interval
	 * @param isAutoSync Whether this is an automatic sync (T015, 002-sync-polish)
	 */
	private async performSync(isAutoSync: boolean): Promise<void> {
		try {
			if (!isAutoSync) {
				showSyncStart();
			}

			// Attempt sync (T015: Pass isAutoSync to sync callback)
			const taskCount = await this.syncCallback(isAutoSync);

			// Success! Reset failure counter
			if (this.consecutiveFailures > 0) {
				Logger.info(`Sync recovered after ${this.consecutiveFailures} consecutive failures`);
				this.consecutiveFailures = 0;
				this.lastErrorMessage = null;
			}

			this.lastSyncTime = new Date();

			if (!isAutoSync) {
				showSyncSuccess(taskCount);
			}

			Logger.debug(`Sync completed: ${taskCount} tasks synced`);
		} catch (error) {
			// Sync failed - track failure and schedule automatic retry
			this.consecutiveFailures++;
			this.lastErrorMessage = error instanceof Error ? error.message : 'Unknown error';

			Logger.error(`Sync failed (${this.consecutiveFailures} consecutive failures): ${this.lastErrorMessage}`, error);

			// Show error to user
			showSyncError(this.lastErrorMessage, [], this.app, isAutoSync);

			// Log that retry will happen on next interval
			if (this.isRunning && isAutoSync) {
				const nextRetryInSeconds = this.config.syncInterval;
				Logger.info(`Automatic retry will occur in ${nextRetryInSeconds} seconds`);
			}

			// Note: We don't stop the scheduler - it will automatically retry on next interval
			// This implements T075: Automatic retry on next interval after sync failure
		}
	}

	/**
	 * Check if scheduler is currently running
	 */
	isSchedulerRunning(): boolean {
		return this.isRunning;
	}
}

/**
 * Sync scheduler for automatic synchronization
 * Implements US5: T027-T030
 */

import { App } from 'obsidian';
import { CalDAVConfiguration } from '../types';
import { showSyncStart, showSyncSuccess, showSyncError } from '../ui/notifications';

/**
 * Callback type for sync operations
 */
export type SyncCallback = () => Promise<number>;

/**
 * Manages automatic sync scheduling and manual triggers
 */
export class SyncScheduler {
	private intervalId: number | null = null;
	private config: CalDAVConfiguration;
	private syncCallback: SyncCallback;
	private isRunning: boolean = false;
	private app: App;

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
			() => this.performSync(true),
			this.config.syncInterval * 1000
		);

		this.isRunning = true;
		console.log(`Sync scheduler started with ${this.config.syncInterval}s interval`);
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
		console.log('Sync scheduler stopped');
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
	 * @param isAutoSync Whether this is an automatic sync
	 */
	private async performSync(isAutoSync: boolean): Promise<void> {
		try {
			if (!isAutoSync) {
				showSyncStart();
			}

			const taskCount = await this.syncCallback();

			if (!isAutoSync) {
				showSyncSuccess(taskCount);
			}

			console.log(`Sync completed: ${taskCount} tasks synced`);
		} catch (error) {
			console.error('Sync error:', error);

			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			showSyncError(errorMessage, [], this.app, isAutoSync);
		}
	}

	/**
	 * Check if scheduler is currently running
	 */
	isSchedulerRunning(): boolean {
		return this.isRunning;
	}
}

/**
 * Sync state management with atomic operations and rollback
 * Implements T074: Add sync state preservation on errors
 */

import { SyncMapping } from "../types";
import { Logger } from "./logger";

/**
 * Backup of sync mappings for rollback
 */
interface MappingBackup {
	mappings: Record<string, SyncMapping>;
	timestamp: Date;
}

/**
 * Sync state manager with atomic operations
 * Provides backup and rollback capabilities for error recovery
 */
export class SyncStateManager {
	private backup: MappingBackup | null = null;

	/**
	 * Create a backup of current sync state
	 * Call this before starting a sync operation
	 * @param currentMappings The current mappings to backup
	 */
	createBackup(currentMappings: Record<string, SyncMapping>): void {
		// Deep clone the mappings to prevent reference issues
		const mappingsCopy: Record<string, SyncMapping> = {};

		for (const [blockId, mapping] of Object.entries(currentMappings)) {
			mappingsCopy[blockId] = {
				...mapping,
				lastSyncTimestamp: new Date(mapping.lastSyncTimestamp),
				lastKnownObsidianModified: new Date(mapping.lastKnownObsidianModified),
				lastKnownCalDAVModified: new Date(mapping.lastKnownCalDAVModified),
			};
		}

		this.backup = {
			mappings: mappingsCopy,
			timestamp: new Date(),
		};

		Logger.debug(`Created state backup with ${Object.keys(mappingsCopy).length} mappings`);
	}

	/**
	 * Restore sync state from backup
	 * Call this when a sync operation fails and needs to rollback
	 * @returns The backed up mappings, or null if no backup exists
	 */
	restoreBackup(): Record<string, SyncMapping> | null {
		if (!this.backup) {
			Logger.warn("No backup available to restore");
			return null;
		}

		Logger.info(`Restoring state from backup (created at ${this.backup.timestamp.toISOString()})`);

		const mappings = this.backup.mappings;
		this.clearBackup();

		return mappings;
	}

	/**
	 * Clear the backup after successful sync
	 * Call this when sync completes successfully
	 */
	clearBackup(): void {
		if (this.backup) {
			Logger.debug("Clearing state backup");
			this.backup = null;
		}
	}

	/**
	 * Check if a backup exists
	 */
	hasBackup(): boolean {
		return this.backup !== null;
	}

	/**
	 * Get backup info for debugging
	 */
	getBackupInfo(): { timestamp: Date; mappingCount: number } | null {
		if (!this.backup) {
			return null;
		}

		return {
			timestamp: this.backup.timestamp,
			mappingCount: Object.keys(this.backup.mappings).length,
		};
	}
}

/**
 * Execute an operation with atomic state management
 * If the operation fails, the state will be rolled back automatically
 *
 * @param operation The async operation to execute
 * @param getCurrentState Function to get current state for backup
 * @param restoreState Function to restore state on rollback
 * @returns The result of the operation
 * @throws The error from the operation after rollback
 */
export async function withAtomicState<T>(
	operation: () => Promise<T>,
	getCurrentState: () => Record<string, SyncMapping>,
	restoreState: (state: Record<string, SyncMapping>) => Promise<void>
): Promise<T> {
	const stateManager = new SyncStateManager();

	try {
		// Create backup before operation
		const currentState = getCurrentState();
		stateManager.createBackup(currentState);

		// Execute the operation
		const result = await operation();

		// Success! Clear backup
		stateManager.clearBackup();

		return result;
	} catch (error) {
		// Operation failed - attempt rollback
		Logger.error("Sync operation failed, attempting rollback", error);

		const backup = stateManager.restoreBackup();

		if (backup) {
			try {
				await restoreState(backup);
				Logger.info("Successfully rolled back sync state");
			} catch (rollbackError) {
				Logger.error("Failed to rollback state - data may be inconsistent", rollbackError);
			}
		}

		// Re-throw the original error
		throw error;
	}
}

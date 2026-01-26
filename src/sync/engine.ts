/**
 * Sync engine for bidirectional task synchronization
 * Based on tasks.md T040-T045 specifications
 * Refactored for Phase 9: Polish & Cross-Cutting Concerns
 */

import { Vault, Notice, App } from "obsidian";
import { Task, CalDAVConfiguration, SyncMapping, CalDAVTask } from "../types";
import { CalDAVClient } from "../caldav/client";
import { SyncFilter } from "./filters";
import { scanVaultForTasks } from "../vault/scanner";
import { updateTaskLine } from "../vault/taskWriter";
import { generateTaskBlockId, embedBlockId } from "../vault/blockRefManager";
import { taskToVTODO } from "../caldav/vtodo";
import { hashTaskContent, getMappingByBlockId, setMapping } from "./mapping";
import {
	showSyncStart,
	showSyncSuccess,
	showSyncError,
} from "../ui/notifications";
import { vtodoToTask } from "../caldav/vtodo";
import { updateTaskInVault } from "../vault/taskWriter";
import {
	resolveConflict,
	formatConflictLog,
	hasConflict,
} from "./conflictResolver";
import { Logger } from "./logger";
import { buildObsidianURI, buildDescriptionWithURI } from "../obsidian/uriBuilder";

/**
 * Sync statistics for tracking sync progress
 */
interface SyncStats {
	successCount: number;
	errorCount: number;
	errors: string[];
}

/**
 * Sync engine class for orchestrating task synchronization
 */
export class SyncEngine {
	private app: App;
	private vault: Vault;
	private config: CalDAVConfiguration;
	private client: CalDAVClient;
	private filter: SyncFilter;
	private saveData: () => Promise<void>;

	constructor(
		app: App,
		vault: Vault,
		config: CalDAVConfiguration,
		saveData: () => Promise<void>
	) {
		this.app = app;
		this.vault = vault;
		this.config = config;
		this.client = new CalDAVClient(app, config);
		this.filter = new SyncFilter(config);
		this.saveData = saveData;
	}

	/**
	 * Update filter with new configuration (T069)
	 * Called when settings change
	 */
	updateFilter(): void {
		this.filter = new SyncFilter(this.config);
	}

	/**
	 * Perform bidirectional sync between Obsidian and CalDAV
	 * This implements T040: Initial sync logic and T058: Bidirectional sync integration
	 * Refactored for better readability and maintainability
	 * @param isAutoSync Whether this is an automatic sync (T009, 002-sync-polish)
	 */
	async syncObsidianToCalDAV(isAutoSync: boolean = false): Promise<void> {
		if (!isAutoSync) {
			showSyncStart();
		}
		// T019: Log sync start at INFO level (always shown)
		Logger.syncStart();

		const stats: SyncStats = {
			successCount: 0,
			errorCount: 0,
			errors: [],
		};

		try {
			// Connect to CalDAV server
			await this.connectToServer();

			// Fetch tasks from both sources
			const { caldavTasks, obsidianTasks } = await this.fetchAllTasks(isAutoSync);

			// Process each Obsidian task
			await this.processObsidianTasks(obsidianTasks, caldavTasks, stats);

			// Disconnect from CalDAV
			await this.client.disconnect();

			// Show sync results
			this.showSyncResults(stats, isAutoSync);

			// T020: Log sync completion at INFO level (always shown)
			Logger.syncComplete();
		} catch (error) {
			this.handleSyncError(error);
			throw error;
		}
	}

	/**
	 * Connect to CalDAV server with error handling
	 * Implements T072: Comprehensive error handling for network failures
	 */
	private async connectToServer(): Promise<void> {
		try {
			await this.client.connect();
			Logger.debug("Connected to CalDAV server");
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : String(error);

			if (
				errorMsg.includes("ERR_CONNECTION_REFUSED") ||
				errorMsg.includes("ECONNREFUSED")
			) {
				throw new Error(
					"Cannot connect to CalDAV server. Please check:\n" +
						"1. The server URL is correct\n" +
						"2. The CalDAV server is running\n" +
						"3. You have network connectivity"
				);
			}

			throw error;
		}
	}

	/**
	 * Fetch tasks from both Obsidian vault and CalDAV server
	 * @param isAutoSync Whether this is an automatic sync (T016, 002-sync-polish)
	 */
	private async fetchAllTasks(isAutoSync: boolean = false): Promise<{
		caldavTasks: CalDAVTask[];
		obsidianTasks: Task[];
	}> {
		// Calculate age threshold for completed tasks
		const ageThreshold = this.calculateAgeThreshold();

		// Fetch from CalDAV with server-side filtering
		const caldavTasks = await this.client.fetchAllTasks(ageThreshold);
		Logger.info(`Fetched ${caldavTasks.length} tasks from CalDAV server`);

		if (ageThreshold) {
			Logger.debug(
				`Server-side filtering active: excluding tasks older than ${ageThreshold.toISOString()}`
			);
		}

		// Scan vault for tasks
		const allTasks = await scanVaultForTasks(this.vault);

		// Apply filters
		const obsidianTasks = allTasks.filter((task) =>
			this.filter.shouldSync(task)
		);

		// Show filter statistics only for manual sync (T016)
		if (!isAutoSync) {
			this.showFilterStats(allTasks.length, obsidianTasks.length);
		}

		return { caldavTasks, obsidianTasks };
	}

	/**
	 * Calculate age threshold for completed tasks
	 */
	private calculateAgeThreshold(): Date | undefined {
		if (this.config.completedTaskAgeDays <= 0) {
			return undefined;
		}

		const threshold = new Date();
		threshold.setDate(
			threshold.getDate() - this.config.completedTaskAgeDays
		);
		return threshold;
	}

	/**
	 * Show filter statistics to user
	 */
	private showFilterStats(totalTasks: number, filteredTasks: number): void {
		const excludedCount = totalTasks - filteredTasks;

		if (excludedCount > 0) {
			new Notice(
				`Found ${filteredTasks} tasks to sync (${excludedCount} excluded by filters)`,
				5000
			);
			Logger.info(`${excludedCount} tasks excluded by filters`);
		} else {
			new Notice(`Found ${filteredTasks} tasks to sync`, 3000);
		}
	}

	/**
	 * Process all Obsidian tasks for sync
	 */
	private async processObsidianTasks(
		obsidianTasks: Task[],
		caldavTasks: CalDAVTask[],
		stats: SyncStats
	): Promise<void> {
		for (const task of obsidianTasks) {
			try {
				await this.processTask(task, caldavTasks, stats);
			} catch (error) {
				this.handleTaskError(task, error, stats);
			}
		}
	}

	/**
	 * Process a single task for sync
	 */
	private async processTask(
		task: Task,
		caldavTasks: CalDAVTask[],
		stats: SyncStats
	): Promise<void> {
		// Handle untracked tasks (no block ID)
		if (!task.blockId || task.blockId === "") {
			await this.handleUntrackedTask(task);
			stats.successCount++;
			return;
		}

		// Get or create mapping for this task
		const mapping = await this.getOrCreateMapping(task, caldavTasks);

		if (!mapping) {
			// No mapping and no matching CalDAV task - skip
			return;
		}

		// Refresh mapping metadata if needed
		await this.refreshMappingMetadata(mapping, caldavTasks);

		// Find corresponding CalDAV task
		const caldavTask = caldavTasks.find(
			(ct) => ct.uid === mapping.caldavUid
		);

		if (!caldavTask) {
			Logger.warn(`CalDAV task not found for UID ${mapping.caldavUid}`);
			// Skip
			return;
		}

		// Perform bidirectional sync
		await this.syncBidirectional(task, caldavTask, mapping);
		stats.successCount++;
	}

	/**
	 * Handle a task that doesn't have a block ID yet
	 */
	private async handleUntrackedTask(task: Task): Promise<void> {
		Logger.debug(`Creating new task: ${task.description}`);
		await this.addBlockIdToTask(task);
		await this.createTaskOnCalDAV(task);
	}

	/**
	 * Get existing mapping or create a new one by matching with CalDAV
	 */
	private async getOrCreateMapping(
		task: Task,
		caldavTasks: CalDAVTask[]
	): Promise<SyncMapping | null> {
		// Check for existing mapping
		let mapping = getMappingByBlockId(task.blockId);

		if (mapping) {
			return mapping;
		}

		Logger.debug(
			`No mapping found for task ${task.blockId}, attempting reconciliation`
		);

		// Try to find matching CalDAV task by description
		const caldavTask = await this.findCalDAVTaskByDescription(
			caldavTasks,
			task.description
		);

		if (caldavTask) {
			Logger.debug(
				`Found matching CalDAV task, reconciling: ${caldavTask.uid}`
			);
			mapping = await this.reconcileTask(task, caldavTask);
			return mapping;
		}

		// No mapping and no matching CalDAV task
		return null;
	}

	/**
	 * Refresh mapping metadata (href, etag) if missing
	 */
	private async refreshMappingMetadata(
		mapping: SyncMapping,
		caldavTasks: CalDAVTask[]
	): Promise<void> {
		// Check if metadata is missing
		if (mapping.caldavHref && mapping.caldavEtag) {
			return; // Already has metadata
		}

		Logger.debug(`Refreshing mapping metadata for task ${mapping.blockId}`);

		// Find the corresponding CalDAV task
		const caldavTask = caldavTasks.find(
			(ct) => ct.uid === mapping.caldavUid
		);

		if (!caldavTask) {
			Logger.warn(
				`Cannot refresh metadata: CalDAV task not found for UID ${mapping.caldavUid}`
			);
			return;
		}

		// Update mapping with missing metadata
		// IMPORTANT: Only refresh href/etag, NOT lastKnownCalDAVModified
		mapping.caldavHref = caldavTask.href;
		mapping.caldavEtag = caldavTask.etag;

		setMapping(mapping);
		await this.saveData();

		Logger.debug(`Metadata refreshed for task ${mapping.blockId}`);
	}

	/**
	 * Perform bidirectional sync between Obsidian and CalDAV
	 */
	private async syncBidirectional(
		task: Task,
		caldavTask: CalDAVTask,
		mapping: SyncMapping
	): Promise<void> {
		// Detect changes from both sides
		const obsidianChanged = this.detectObsidianChanges(task, mapping);
		const caldavChanged = this.detectCalDAVChanges(caldavTask, mapping);

		// Handle conflicts
		if (hasConflict(obsidianChanged, caldavChanged)) {
			await this.handleConflict(task, caldavTask, mapping);
			return;
		}

		// Handle Obsidian changes
		if (obsidianChanged) {
			Logger.debug(`Obsidian changes detected for: ${task.description}`);
			await this.updateCalDAVTask(task, mapping);
			return;
		}

		// Handle CalDAV changes
		if (caldavChanged) {
			Logger.debug(`CalDAV changes detected for: ${task.description}`);
			await this.updateObsidianTask(task, caldavTask, mapping);
			return;
		}

		// Check for data mismatch (edge case)
		// This handles cases where timestamp-based change detection fails
		// (e.g., clock skew, server not updating LAST-MODIFIED properly)
		if (this.needsReconciliation(task, caldavTask)) {
			Logger.warn(`Data mismatch detected for: ${task.description}`);
			Logger.warn(`  Obsidian: "${task.description}" (${task.status})`);
			Logger.warn(
				`  CalDAV: "${caldavTask.summary}" (${caldavTask.status})`
			);

			// Determine direction: if Obsidian hash unchanged, CalDAV must have changed
			const currentHash = hashTaskContent(task);
			const obsidianUnchanged =
				currentHash === mapping.lastKnownContentHash;

			if (obsidianUnchanged) {
				// Obsidian data unchanged since last sync, so CalDAV must have changed
				// Pull changes from CalDAV to Obsidian
				Logger.warn(`  Obsidian unchanged, pulling from CalDAV...`);
				await this.updateObsidianTask(task, caldavTask, mapping);
			} else {
				// Obsidian changed, push to CalDAV
				Logger.warn(`  Obsidian changed, pushing to CalDAV...`);
				await this.updateCalDAVTask(task, mapping);
			}
		}
	}

	/**
	 * Handle conflicts when both sides have changed
	 */
	private async handleConflict(
		task: Task,
		caldavTask: CalDAVTask,
		mapping: SyncMapping
	): Promise<void> {
		Logger.info(`Conflict detected for task: ${task.description}`);

		// Resolve conflict using last-write-wins
		const resolution = resolveConflict(task, caldavTask, mapping);

		// Log the conflict resolution
		const logMessage = formatConflictLog(resolution, task.description);
		Logger.info(logMessage);

		// Apply the winning side
		if (resolution.winner === "caldav") {
			await this.updateObsidianTask(task, caldavTask, mapping);
		} else {
			await this.updateCalDAVTask(task, mapping);
		}
	}

	/**
	 * Handle task processing error
	 * Implements T044: Error handling for failed task uploads
	 */
	private handleTaskError(
		task: Task,
		error: unknown,
		stats: SyncStats
	): void {
		stats.errorCount++;
		const errorMsg = error instanceof Error ? error.message : String(error);
		const errorLocation = `${task.filePath}:${task.lineNumber}`;
		stats.errors.push(`${errorLocation} - ${errorMsg}`);

		Logger.error(`Failed to sync task at ${errorLocation}`, error);
	}

	/**
	 * Handle sync-level error
	 * Implements T044: Error handling
	 */
	private handleSyncError(error: unknown): void {
		const errorMsg = error instanceof Error ? error.message : String(error);
		Logger.error(`Sync failed: ${errorMsg}`, error);
		showSyncError(`Sync failed: ${errorMsg}`, []);
	}

	/**
	 * Show sync results to user
	 * Implements T045: Sync progress feedback
	 * @param isAutoSync Whether this is an automatic sync (T012, 002-sync-polish)
	 */
	private showSyncResults(stats: SyncStats, isAutoSync: boolean = false): void {
		if (stats.errorCount === 0) {
			Logger.info(`Successfully synced ${stats.successCount} tasks`);
			// Only show success notification for manual sync (T012)
			if (!isAutoSync) {
				showSyncSuccess(`Successfully synced ${stats.successCount} tasks`);
			}
		} else {
			Logger.warn(
				`Sync completed with errors: ${stats.successCount} succeeded, ${stats.errorCount} failed`
			);
			// Always show errors (both auto and manual sync)
			showSyncError(
				`Sync completed with errors: ${stats.successCount} succeeded, ${stats.errorCount} failed`,
				stats.errors
			);
		}
	}

	/**
	 * Add block ID to a task that doesn't have one
	 * Implements T042: Block ID generation for untracked tasks
	 */
	private async addBlockIdToTask(task: Task): Promise<void> {
		// Generate new block ID
		const blockId = generateTaskBlockId();

		// Update task object
		task.blockId = blockId;

		// Embed block ID in the task line
		const newLine = embedBlockId(task.rawLine, blockId);

		// Update the file
		await updateTaskLine(this.vault, task, newLine);

		// Update rawLine in task object
		task.rawLine = newLine;
	}

	/**
	 * Create a task on CalDAV server and store mapping
	 *
	 * Implements T038: CalDAV task creation and T043: Store sync mappings
	 * Feature: Obsidian Link Sync (003-obsidian-link-sync)
	 *
	 * This method now generates an Obsidian deep link URI and includes it in the
	 * CalDAV DESCRIPTION field during initial task creation. The URI enables users
	 * to click a link in their CalDAV client (e.g., Apple Calendar, Google Calendar)
	 * and jump directly to the task location in Obsidian.
	 *
	 * URI Format: obsidian://open?vault={encoded-vault}&file={encoded-path}&block={block-id}
	 *
	 * Error handling: URI generation failures are logged as warnings but do not
	 * prevent task sync (graceful degradation). Tasks without block IDs will sync
	 * successfully but without the Obsidian URI.
	 */
	private async createTaskOnCalDAV(task: Task): Promise<void> {
		// Convert task to VTODO format (T037)
		const vtodoData = taskToVTODO(task);

		// Generate Obsidian URI with error handling (T013-T018)
		// This provides a clickable deep link in CalDAV clients to open Obsidian
		// directly to the task location within the source note.
		let description: string | undefined;
		try {
			// Get vault name from Obsidian API (T014)
			const vaultName = this.vault.getName();

			// Validate block ID before attempting URI generation (T015)
			if (!task.blockId) {
				console.warn('Skipping URI generation: task missing block ID');
			} else {
				// Generate URI and format DESCRIPTION (T016)
				const uri = buildObsidianURI(vaultName, task.filePath, task.blockId);
				description = buildDescriptionWithURI(uri);
			}
		} catch (error) {
			// Log warning but continue task creation - graceful degradation (T018)
			console.warn(`Failed to generate Obsidian URI for task: ${error instanceof Error ? error.message : String(error)}`);
		}

		// Create task on CalDAV server with optional description (T017, T038)
		const caldavTask = await this.client.createTask(
			vtodoData.summary,
			vtodoData.due,
			vtodoData.status,
			description
		);

		Logger.debug(`Created CalDAV task: ${caldavTask.uid}`);

		// T043: Store sync mapping after successful creation
		const mapping: SyncMapping = {
			blockId: task.blockId,
			caldavUid: caldavTask.uid,
			lastSyncTimestamp: new Date(),
			lastKnownContentHash: hashTaskContent(task),
			lastKnownObsidianModified: new Date(),
			lastKnownCalDAVModified: caldavTask.lastModified,
			caldavEtag: caldavTask.etag,
			caldavHref: caldavTask.href,
		};

		setMapping(mapping);

		// Persist mappings to plugin data
		await this.saveData();
	}

	/**
	 * Check if CalDAV data matches what we expect based on Obsidian task
	 * @param task The Obsidian task
	 * @param caldavTask The CalDAV task
	 * @returns true if reconciliation is needed (data doesn't match)
	 */
	private needsReconciliation(task: Task, caldavTask: CalDAVTask): boolean {
		// Convert task to expected VTODO format
		const expected = taskToVTODO(task);

		// Compare description
		if (expected.summary !== caldavTask.summary) {
			return true;
		}

		// Compare status
		if (expected.status !== caldavTask.status) {
			return true;
		}

		// Compare due date (normalize to date-only comparison)
		const expectedDate = expected.due
			? `${expected.due.getUTCFullYear()}-${String(
					expected.due.getUTCMonth() + 1
			  ).padStart(2, "0")}-${String(expected.due.getUTCDate()).padStart(
					2,
					"0"
			  )}`
			: null;

		const caldavDate = caldavTask.due
			? `${caldavTask.due.getUTCFullYear()}-${String(
					caldavTask.due.getUTCMonth() + 1
			  ).padStart(2, "0")}-${String(
					caldavTask.due.getUTCDate()
			  ).padStart(2, "0")}`
			: null;

		if (expectedDate !== caldavDate) {
			return true;
		}

		return false;
	}

	/**
	 * Detect if a task has changed in Obsidian since last sync
	 * Implements T046: Change detection
	 * @param task The current task from vault
	 * @param mapping The existing sync mapping
	 * @returns true if task has changed
	 */
	private detectObsidianChanges(task: Task, mapping: SyncMapping): boolean {
		// Calculate current content hash
		const currentHash = hashTaskContent(task);
		const hasChanged = currentHash !== mapping.lastKnownContentHash;

		if (hasChanged) {
			Logger.debug(`Obsidian task changed: ${task.blockId}`);
			Logger.debug(`  Current hash: ${currentHash}`);
			Logger.debug(`  Stored hash: ${mapping.lastKnownContentHash}`);
		}

		return hasChanged;
	}

	/**
	 * Detect if a task has changed on CalDAV server since last sync
	 * Implements T054: Change detection for CalDAV
	 * @param caldavTask The current task from CalDAV server
	 * @param mapping The existing sync mapping
	 * @returns true if task has changed on CalDAV
	 */
	private detectCalDAVChanges(
		caldavTask: CalDAVTask,
		mapping: SyncMapping
	): boolean {
		// Compare lastModified timestamps
		// If CalDAV's lastModified is newer than what we have stored, it changed
		// NOTE: Normalize to seconds precision because CalDAV servers strip milliseconds
		const caldavModified = Math.floor(
			caldavTask.lastModified.getTime() / 1000
		);
		const lastKnown = Math.floor(
			mapping.lastKnownCalDAVModified.getTime() / 1000
		);
		const hasChanged = caldavModified > lastKnown;

		if (hasChanged) {
			Logger.debug(`CalDAV task changed: ${caldavTask.uid}`);
			Logger.debug(
				`  CalDAV modified: ${caldavTask.lastModified.toISOString()}`
			);
			Logger.debug(
				`  Last known: ${mapping.lastKnownCalDAVModified.toISOString()}`
			);
		}

		return hasChanged;
	}

	/**
	 * Update a task on CalDAV server
	 * Implements T048: Update sync logic
	 * Updated for T029-T030 (002-sync-polish): Use property preservation
	 * @param task The updated task from vault
	 * @param mapping The existing sync mapping
	 */
	private async updateCalDAVTask(
		task: Task,
		mapping: SyncMapping
	): Promise<void> {
		// Validate that we have the required CalDAV metadata
		if (!mapping.caldavHref || !mapping.caldavEtag) {
			throw new Error(
				`Cannot update task: missing CalDAV metadata (href: ${mapping.caldavHref}, etag: ${mapping.caldavEtag}). ` +
					`This should have been refreshed during sync. Please try syncing again.`
			);
		}

		// Convert task to VTODO format
		const vtodoData = taskToVTODO(task);

		// Get the stored CalDAV metadata from mapping
		const caldavUid = mapping.caldavUid;
		const caldavEtag = mapping.caldavEtag;
		const caldavHref = mapping.caldavHref;

		// T029-T030: Update task using property preservation pattern
		const updatedTask = await this.client.updateTaskWithPreservation(
			caldavUid,
			vtodoData.summary,
			vtodoData.due,
			vtodoData.status,
			caldavEtag,
			caldavHref
		);

		// T050: Update sync mapping timestamps and hashes after successful update
		mapping.lastSyncTimestamp = new Date();
		mapping.lastKnownContentHash = hashTaskContent(task);
		mapping.lastKnownObsidianModified = new Date();
		mapping.lastKnownCalDAVModified = updatedTask.lastModified;
		mapping.caldavEtag = updatedTask.etag;
		mapping.caldavHref = updatedTask.href;

		setMapping(mapping);

		// Persist mappings to plugin data
		await this.saveData();
	}

	/**
	 * Update a task in Obsidian vault from CalDAV server
	 * Implements T056: CalDAV-to-Obsidian sync logic
	 * Implements T059: Update sync mapping timestamps
	 * @param task The existing task in the vault
	 * @param caldavTask The updated task from CalDAV server
	 * @param mapping The existing sync mapping
	 */
	private async updateObsidianTask(
		task: Task,
		caldavTask: CalDAVTask,
		mapping: SyncMapping
	): Promise<void> {
		// Convert CalDAV task to Obsidian format
		const updatedData = vtodoToTask(caldavTask);

		// Update task in vault (uses Tasks Plugin API if available)
		await updateTaskInVault(
			this.app,
			this.vault,
			task,
			updatedData.description,
			updatedData.dueDate,
			updatedData.status
		);

		// T059: Update sync mapping timestamps after successful update
		mapping.lastSyncTimestamp = new Date();
		mapping.lastKnownContentHash = hashTaskContent(task);
		mapping.lastKnownObsidianModified = new Date();
		mapping.lastKnownCalDAVModified = caldavTask.lastModified;
		mapping.caldavEtag = caldavTask.etag;
		mapping.caldavHref = caldavTask.href;

		setMapping(mapping);

		// Persist mappings to plugin data
		await this.saveData();
	}

	/**
	 * Find a CalDAV task by matching description
	 * Used for reconciliation when mapping is lost
	 * @param caldavTasks List of CalDAV tasks
	 * @param description Task description to match
	 * @returns Matching CalDAV task or undefined
	 */
	private async findCalDAVTaskByDescription(
		caldavTasks: CalDAVTask[],
		description: string
	): Promise<CalDAVTask | undefined> {
		// Match by description (case-insensitive)
		return caldavTasks.find(
			(ct) => ct.summary.toLowerCase() === description.toLowerCase()
		);
	}

	/**
	 * Reconcile a task by creating a mapping to an existing CalDAV task
	 * This handles the case where blockId exists but mapping was lost
	 * @param task The Obsidian task
	 * @param caldavTask The existing CalDAV task
	 */
	private async reconcileTask(
		task: Task,
		caldavTask: CalDAVTask
	): Promise<SyncMapping> {
		Logger.info(
			`Reconciling task: ${task.description} with CalDAV UID: ${caldavTask.uid}`
		);

		// Create mapping to link Obsidian task with existing CalDAV task
		const mapping: SyncMapping = {
			blockId: task.blockId,
			caldavUid: caldavTask.uid,
			lastSyncTimestamp: new Date(),
			lastKnownContentHash: hashTaskContent(task),
			lastKnownObsidianModified: new Date(),
			lastKnownCalDAVModified: caldavTask.lastModified,
			caldavEtag: caldavTask.etag,
			caldavHref: caldavTask.href,
		};

		setMapping(mapping);

		// Persist mappings to plugin data
		await this.saveData();

		return mapping;
	}
}

/**
 * Sync engine for bidirectional task synchronization
 * Based on tasks.md T040-T045 specifications
 */

import { Vault, Notice } from "obsidian";
import { Task, CalDAVConfiguration, SyncMapping, CalDAVTask } from "../types";
import { CalDAVClient } from "../caldav/client";
import { SyncFilter } from "./filters";
import { scanVaultForTasks } from "../vault/scanner";
import { updateTaskLine, buildTaskLine } from "../vault/taskWriter";
import {
	generateTaskBlockId,
	embedBlockId,
	hasBlockId,
} from "../vault/blockRefManager";
import { taskToVTODO } from "../caldav/vtodo";
import {
	hashTaskContent,
	getMappingByBlockId,
	setMapping,
	saveMappings,
	getAllMappings,
} from "./mapping";
import {
	showSyncStart,
	showSyncSuccess,
	showSyncError,
} from "../ui/notifications";
import { vtodoToTask } from "../caldav/vtodo";
import { updateTaskInVault } from "../vault/taskWriter";
import { resolveConflict, formatConflictLog, hasConflict } from "./conflictResolver";

/**
 * Sync engine class for orchestrating task synchronization
 */
export class SyncEngine {
	private vault: Vault;
	private config: CalDAVConfiguration;
	private client: CalDAVClient;
	private filter: SyncFilter;
	private saveData: () => Promise<void>;

	constructor(
		vault: Vault,
		config: CalDAVConfiguration,
		saveData: () => Promise<void>
	) {
		this.vault = vault;
		this.config = config;
		this.client = new CalDAVClient(config);
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
	 */
	async syncObsidianToCalDAV(): Promise<void> {
		showSyncStart();

		let successCount = 0;
		let errorCount = 0;
		const errors: string[] = [];

		try {
			// DEBUG
			console.log("Starting Obsidian to CalDAV sync...");

			// Connect to CalDAV server with proper error handling
			try {
				await this.client.connect();
			} catch (error) {
				// Provide user-friendly error messages for connection issues
				const errorMsg =
					error instanceof Error ? error.message : String(error);

					if (errorMsg.includes("ERR_CONNECTION_REFUSED") || errorMsg.includes("ECONNREFUSED")) {
					throw new Error(
						"Cannot connect to CalDAV server. Please check:\n" +
							"1. The server URL is correct\n" +
							"2. The CalDAV server is running\n" +
							"3. You have network connectivity"
					);
				}

				throw error;
			}

			// Fetch existing CalDAV tasks with server-side filtering
			// Pass age threshold to filter old completed tasks at the CalDAV server level
			// This is more efficient than downloading all tasks and filtering client-side
			const ageThreshold = this.config.completedTaskAgeDays > 0
				? (() => {
					const threshold = new Date();
					threshold.setDate(threshold.getDate() - this.config.completedTaskAgeDays);
					return threshold;
				})()
				: undefined;

			const caldavTasks = await this.client.fetchAllTasks(ageThreshold);

			// DEBUG
			console.log(
				`Fetched ${caldavTasks.length} tasks from CalDAV server (server-side filtering applied)`
			);

			// Scan vault for tasks (T033)
			const tasks = await scanVaultForTasks(this.vault);

			// Filter tasks (T039)
			const filteredTasks = tasks.filter((task) =>
				this.filter.shouldSync(task)
			);

			// T071: Show warning notification for filtered tasks
			const obsidianFilteredCount = tasks.length - filteredTasks.length;

			if (obsidianFilteredCount > 0) {
				new Notice(
					`Found ${filteredTasks.length} tasks to sync (${obsidianFilteredCount} excluded by filters)`,
					5000
				);
				console.log(`[CalDAV Sync] ${obsidianFilteredCount} Obsidian tasks excluded by filter rules`);
			} else {
				new Notice(`Found ${filteredTasks.length} tasks to sync`, 3000);
			}

			// Note: CalDAV tasks are filtered server-side, so we don't have a count of excluded CalDAV tasks
			if (ageThreshold) {
				console.log(`[CalDAV Sync] Server-side filtering active: excluding CalDAV tasks older than ${ageThreshold.toISOString()}`);
			}

			// Process each task (Obsidian to CalDAV direction)
			for (const task of filteredTasks) {
				try {
					// T042: Generate block ID for untracked tasks
					if (!task.blockId || task.blockId === "") {
						await this.addBlockIdToTask(task);
						// Task needs to be created on CalDAV server
						await this.createTaskOnCalDAV(task);
						successCount++;

						continue; // Move to next task
					} else {
						// DEBUG
						console.log(`Processing task with blockId: ${task.blockId}`);

						// Check if task already has a mapping
						var existingMapping = getMappingByBlockId(task.blockId);

						if (!existingMapping) {
							// DEBUG
							console.log(
								"No existing mapping for blockId:",
								task.blockId
							);

							// Task has blockId but no mapping - check if it exists on CalDAV
							const existingCalDAVTask =
								await this.findCalDAVTaskByDescription(
									caldavTasks,
									task.description
								);

							// DEBUG
							console.log(
								"Existing CalDAV task found:",
								existingCalDAVTask
							);
							if (existingCalDAVTask) {
								// Task exists on CalDAV - reconcile by creating mapping
								existingMapping = await this.reconcileTask(
									task,
									existingCalDAVTask
								);
								successCount++;
							} else {
								continue; // No mapping and no CalDAV task - skip
							}
						} else {
							// DEBUG
							console.log(
								"Found existing mapping for blockId:",
								task.blockId,
								existingMapping
							);

							// Mapping exists - check if it needs metadata refresh
							// This handles old mappings created before caldavHref/caldavEtag were added
							// IMPORTANT: Only refresh href/etag, NOT lastKnownCalDAVModified (that would break change detection)
							if (!existingMapping.caldavHref || !existingMapping.caldavEtag) {
								console.log(
									"Refreshing mapping metadata from CalDAV:",
									task.blockId
								);

								// Find the corresponding CalDAV task by UID
								const caldavTask = caldavTasks.find(
									(ct) =>
										ct.uid === existingMapping!.caldavUid
								);

								if (caldavTask) {
									// Update mapping with missing metadata
									// DO NOT update lastKnownCalDAVModified here - that would defeat change detection!
									existingMapping.caldavHref = caldavTask.href;
									existingMapping.caldavEtag = caldavTask.etag;

									setMapping(existingMapping);
									await this.saveData();

									console.log(
										"Updated mapping metadata from CalDAV:",
										existingMapping
									);
								} else {
									console.warn(
										`CalDAV task not found for UID ${existingMapping.caldavUid}, skipping update`
									);
									continue;
								}
							}
						}

						// DEBUG
						console.log(
							"Existing mapping found for:",
							task.blockId,
							existingMapping
						);

						// Find the corresponding CalDAV task
						const caldavTask = caldavTasks.find(
							(ct) => ct.uid === existingMapping!.caldavUid
						);

						if (!caldavTask) {
							console.warn(
								`CalDAV task not found for UID ${existingMapping!.caldavUid}, skipping`
							);
							continue;
						}

						// T058: Bidirectional sync - detect changes from both sides
						const obsidianChanged = this.detectObsidianChanges(task, existingMapping);
						const caldavChanged = this.detectCalDAVChanges(caldavTask, existingMapping);

						// Check if we have a conflict (both sides changed)
						if (hasConflict(obsidianChanged, caldavChanged)) {
							console.log(
								`Conflict detected for task: ${task.description}`
							);

							// Resolve conflict using last-write-wins
							const resolution = resolveConflict(task, caldavTask, existingMapping);

							// Log the conflict resolution
							const logMessage = formatConflictLog(resolution, task.description);
							console.log(logMessage);

							// Apply the winning side
							if (resolution.winner === 'caldav') {
								// CalDAV wins - update Obsidian
								await this.updateObsidianTask(task, caldavTask, existingMapping);
								successCount++;
							} else {
								// Obsidian wins - update CalDAV
								await this.updateCalDAVTask(task, existingMapping);
								successCount++;
							}
						} else if (obsidianChanged) {
							// Only Obsidian changed - update CalDAV
							console.log(
								"Obsidian changes detected for task:",
								task.description
							);
							await this.updateCalDAVTask(task, existingMapping);
							successCount++;
						} else if (caldavChanged) {
							// Only CalDAV changed - update Obsidian
							console.log(
								"CalDAV changes detected for task:",
								task.description
							);
							await this.updateObsidianTask(task, caldavTask, existingMapping);
							successCount++;
						} else {
							// Check for data mismatch even if no changes detected
							const needsReconciliation = this.needsReconciliation(task, caldavTask);

							if (needsReconciliation) {
								console.warn(
									`CalDAV data mismatch detected for task: ${task.description}`
								);
								console.warn(
									`  Obsidian: "${task.description}" (${task.status})`
								);
								console.warn(
									`  CalDAV: "${caldavTask.summary}" (${caldavTask.status})`
								);
								console.warn(`  Forcing update to CalDAV...`);
								await this.updateCalDAVTask(task, existingMapping);
								successCount++;
							}
						}
					}
				} catch (error) {
					// T044: Error handling for failed task uploads
					errorCount++;
					const errorMsg =
						error instanceof Error ? error.message : String(error);
					errors.push(
						`${task.filePath}:${task.lineNumber} - ${errorMsg}`
					);
					console.error(
						`Failed to sync task at ${task.filePath}:${task.lineNumber}:`,
						error
					);
					// Continue with next task (skip and continue logic)
				}
			}

			// Disconnect from CalDAV
			await this.client.disconnect();

			// T045: Sync progress feedback
			if (errorCount === 0) {
				showSyncSuccess(`Successfully synced ${successCount} tasks`);
			} else {
				showSyncError(
					`Sync completed with errors: ${successCount} succeeded, ${errorCount} failed`,
					errors
				);
			}
		} catch (error) {
			// T044: Error handling
			const errorMsg =
				error instanceof Error ? error.message : String(error);
			showSyncError(`Sync failed: ${errorMsg}`, []);
			throw error;
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
	 * Implements T038: CalDAV task creation and T043: Store sync mappings
	 */
	private async createTaskOnCalDAV(task: Task): Promise<void> {
		// Convert task to VTODO format (T037)
		const vtodoData = taskToVTODO(task);

		// Create task on CalDAV server (T038)
		const caldavTask = await this.client.createTask(
			vtodoData.summary,
			vtodoData.due,
			vtodoData.status
		);

		// DEBUG
		console.log("Created CalDAV task:", caldavTask);

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
	private needsReconciliation(
		task: Task,
		caldavTask: CalDAVTask
	): boolean {
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
			  ).padStart(2, "0")}-${String(caldavTask.due.getUTCDate()).padStart(
					2,
					"0"
			  )}`
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

		//DEBUG
		console.log("=== Change Detection Debug ===");
		console.log("Task blockId:", task.blockId);
		console.log("Task description:", JSON.stringify(task.description));
		console.log("Task status:", task.status);
		console.log("Task dueDate:", task.dueDate?.toISOString());
		console.log("Current hash:", currentHash);
		console.log("Stored hash:", mapping.lastKnownContentHash);
		console.log("Hashes match:", currentHash === mapping.lastKnownContentHash);

		// Calculate what the hash string looks like
		const dateString = task.dueDate
			? `${task.dueDate.getUTCFullYear()}-${String(task.dueDate.getUTCMonth() + 1).padStart(2, '0')}-${String(task.dueDate.getUTCDate()).padStart(2, '0')}`
			: 'null';
		const hashInput = `${task.description}|${dateString}|${task.status}`;
		console.log("Hash input string:", JSON.stringify(hashInput));
		console.log("================================");

		// Compare with last known hash
		return currentHash !== mapping.lastKnownContentHash;
	}

	/**
	 * Detect if a task has changed on CalDAV server since last sync
	 * Implements T054: Change detection for CalDAV
	 * @param caldavTask The current task from CalDAV server
	 * @param mapping The existing sync mapping
	 * @returns true if task has changed on CalDAV
	 */
	private detectCalDAVChanges(caldavTask: CalDAVTask, mapping: SyncMapping): boolean {
		// Compare lastModified timestamps
		// If CalDAV's lastModified is newer than what we have stored, it changed
		// NOTE: Normalize to seconds precision because CalDAV servers strip milliseconds
		const caldavModified = Math.floor(caldavTask.lastModified.getTime() / 1000);
		const lastKnown = Math.floor(mapping.lastKnownCalDAVModified.getTime() / 1000);

		// DEBUG
		console.log("=== CalDAV Change Detection Debug ===");
		console.log("CalDAV UID:", caldavTask.uid);
		console.log("CalDAV summary:", JSON.stringify(caldavTask.summary));
		console.log("CalDAV status:", caldavTask.status);
		console.log("CalDAV dueDate:", caldavTask.due?.toISOString());
		console.log("CalDAV lastModified:", caldavTask.lastModified.toISOString());
		console.log("Stored lastKnownCalDAVModified:", mapping.lastKnownCalDAVModified.toISOString());
		console.log("CalDAV modified (seconds):", caldavModified);
		console.log("Last known (seconds):", lastKnown);
		console.log("Has changed:", caldavModified > lastKnown);
		console.log("====================================");

		return caldavModified > lastKnown;
	}

	/**
	 * Update a task on CalDAV server
	 * Implements T048: Update sync logic
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

		// T047: Update task on CalDAV server with ETag handling
		const updatedTask = await this.client.updateTask(
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

		// Update task in vault
		await updateTaskInVault(
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

		console.log(
			`Reconciled task: ${task.description} with CalDAV UID: ${caldavTask.uid}`
		);

		return mapping;
	}
}

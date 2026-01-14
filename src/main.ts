import { Plugin } from "obsidian";
import { CalDAVConfiguration, PluginData } from "./types";
import { DEFAULT_SETTINGS } from "./settings";
import { CalDAVSettingsTab } from "./ui/settingsTab";
import { SyncScheduler } from "./sync/scheduler";
import { SyncEngine } from "./sync/engine";
import { loadMappings, saveMappings } from "./sync/mapping";
import { setDebugMode } from "./sync/logger";

/**
 * Main plugin class for CalDAV Task Synchronization
 */
export default class CalDAVTaskSyncPlugin extends Plugin {
	settings!: CalDAVConfiguration;
	syncScheduler: SyncScheduler | null = null;
	syncEngine: SyncEngine | null = null;
	private syncIntervalId: number | null = null;

	/**
	 * Plugin initialization - called when plugin is loaded
	 */
	async onload() {
		console.log("Loading CalDAV Task Sync plugin");

		// Load saved settings
		await this.loadSettings();

		// Initialize debug logging mode based on settings
		setDebugMode(this.settings.enableDebugLogging);

		// Initialize sync engine (Phase 5 - US1: T041)
		this.syncEngine = new SyncEngine(
			this.app.vault,
			this.settings,
			async () => await this.savePluginData()
		);

		// Add settings tab (Phase 3 - US4: T023)
		this.addSettingTab(new CalDAVSettingsTab(this.app, this));

		// Initialize sync scheduler (Phase 4 - US5: T027-T028)
		// T015: Pass isAutoSync parameter to performSync
		this.syncScheduler = new SyncScheduler(
			this.app,
			this.settings,
			async (isAutoSync: boolean) => await this.performSync(isAutoSync)
		);

		// Start automatic sync if enabled
		if (this.settings.enableAutoSync) {
			this.syncScheduler.start();
		}

		// Register manual sync command (Phase 4 - US5: T029)
		this.addCommand({
			id: "manual-sync",
			name: "Sync tasks now",
			callback: async () => {
				if (this.syncScheduler) {
					await this.syncScheduler.manualSync();
				}
			},
		});
	}

	/**
	 * Plugin cleanup - called when plugin is unloaded
	 */
	onunload() {
		console.log("Unloading CalDAV Task Sync plugin");

		// Stop sync scheduler
		if (this.syncScheduler) {
			this.syncScheduler.stop();
		}

		// Clean up sync interval (legacy)
		if (this.syncIntervalId !== null) {
			window.clearInterval(this.syncIntervalId);
			this.syncIntervalId = null;
		}
	}

	/**
	 * Perform sync operation (Phase 5 - US1: T041)
	 * @param isAutoSync Whether this is an automatic sync (T015, 002-sync-polish)
	 * @returns Number of tasks synced
	 */
	private async performSync(isAutoSync: boolean = false): Promise<number> {
		if (!this.syncEngine) {
			console.error("Sync engine not initialized");
			return 0;
		}

		try {
			// Perform sync from Obsidian to CalDAV (T015: Pass isAutoSync)
			await this.syncEngine.syncObsidianToCalDAV(isAutoSync);
			return 0; // TODO: Return actual count in future
		} catch (error) {
			console.error("Sync failed:", error);
			throw error;
		}
	}

	/**
	 * Load settings from plugin data storage
	 */
	async loadSettings() {
		const data = (await this.loadData()) as PluginData | null;

		if (data && data.settings) {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);

			// Load sync mappings if they exist
			if (data.syncState && data.syncState.mappings) {
				loadMappings(data.syncState.mappings);
			} else {
				// Initialize empty mappings if no sync state exists
				loadMappings({});
			}
		} else {
			this.settings = Object.assign({}, DEFAULT_SETTINGS);
			// Initialize empty mappings for new installations
			loadMappings({});
		}
	}

	/**
	 * Save settings to plugin data storage
	 */
	async saveSettings() {
		await this.savePluginData();
	}

	/**
	 * Save all plugin data (settings and sync state)
	 */
	async savePluginData() {
		const data: PluginData = {
			version: 1,
			settings: this.settings,
			syncState: {
				mappings: saveMappings(),
			},
		};

		await this.saveData(data);
	}
}

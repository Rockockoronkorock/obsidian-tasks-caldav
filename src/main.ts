import { Plugin } from 'obsidian';
import { CalDAVConfiguration, PluginData } from './types';
import { DEFAULT_SETTINGS } from './settings';
import { CalDAVSettingsTab } from './ui/settingsTab';
import { SyncScheduler } from './sync/scheduler';

/**
 * Main plugin class for CalDAV Task Synchronization
 */
export default class CalDAVTaskSyncPlugin extends Plugin {
	settings!: CalDAVConfiguration;
	syncScheduler: SyncScheduler | null = null;
	private syncIntervalId: number | null = null;

	/**
	 * Plugin initialization - called when plugin is loaded
	 */
	async onload() {
		console.log('Loading CalDAV Task Sync plugin');

		// Load saved settings
		await this.loadSettings();

		// Add settings tab (Phase 3 - US4: T023)
		this.addSettingTab(new CalDAVSettingsTab(this.app, this));

		// Initialize sync scheduler (Phase 4 - US5: T027-T028)
		this.syncScheduler = new SyncScheduler(
			this.app,
			this.settings,
			async () => await this.performSync()
		);

		// Start automatic sync if enabled
		if (this.settings.enableAutoSync) {
			this.syncScheduler.start();
		}

		// Register manual sync command (Phase 4 - US5: T029)
		this.addCommand({
			id: 'manual-sync',
			name: 'Sync tasks now',
			callback: async () => {
				if (this.syncScheduler) {
					await this.syncScheduler.manualSync();
				}
			}
		});

		// TODO: Implement sync engine (Phase 5 - US1)
	}

	/**
	 * Plugin cleanup - called when plugin is unloaded
	 */
	onunload() {
		console.log('Unloading CalDAV Task Sync plugin');

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
	 * Perform sync operation
	 * @returns Number of tasks synced
	 */
	private async performSync(): Promise<number> {
		// TODO: Implement in Phase 5 - US1
		// Placeholder: return 0 for now
		console.log('Sync operation triggered (not yet implemented)');
		return 0;
	}

	/**
	 * Load settings from plugin data storage
	 */
	async loadSettings() {
		const data = await this.loadData() as PluginData | null;

		if (data && data.settings) {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
		} else {
			this.settings = Object.assign({}, DEFAULT_SETTINGS);
		}
	}

	/**
	 * Save settings to plugin data storage
	 */
	async saveSettings() {
		const data: PluginData = {
			version: 1,
			settings: this.settings,
			syncState: {
				mappings: {}
			}
		};

		await this.saveData(data);
	}
}

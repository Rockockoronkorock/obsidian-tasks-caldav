/**
 * Settings tab UI for CalDAV Task Synchronization plugin
 * Implements User Story 4 (Configure CalDAV Connection) and User Story 5 (Configure Auto-Sync)
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import CalDAVTaskSyncPlugin from '../main';
import { CalDAVClient } from '../caldav/client';
import { CalDAVAuthError, CalDAVNetworkError } from '../caldav/errors';
import { setDebugMode } from '../sync/logger';

export class CalDAVSettingsTab extends PluginSettingTab {
	plugin: CalDAVTaskSyncPlugin;

	constructor(app: App, plugin: CalDAVTaskSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'CalDAV Task Synchronization' });

		// Connection Settings Section
		this.addConnectionSection(containerEl);

		// Sync Settings Section
		this.addSyncSection(containerEl);

		// Filter Settings Section
		this.addFilterSection(containerEl);
	}

	/**
	 * Add connection settings section (US4: T014-T023)
	 */
	private addConnectionSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Connection Settings' });

		// Warning about credential storage
		const warningEl = containerEl.createDiv({ cls: 'callout' });
		warningEl.createEl('strong', { text: '⚠️ Security Notice' });
		warningEl.createEl('p', {
			text: 'Credentials are stored locally in your vault. Ensure your vault is encrypted and secured. Consider using app-specific passwords if your CalDAV provider supports them.'
		});

		// Server URL (T015)
		new Setting(containerEl)
			.setName('Server URL')
			.setDesc('CalDAV server URL (must start with https://)')
			.addText(text => text
				.setPlaceholder('https://caldav.example.com')
				.setValue(this.plugin.settings.serverUrl)
				.onChange(async (value) => {
					this.plugin.settings.serverUrl = value;
					await this.plugin.saveSettings();
				}));

		// Username (T016)
		new Setting(containerEl)
			.setName('Username')
			.setDesc('Your CalDAV username')
			.addText(text => text
				.setPlaceholder('user@example.com')
				.setValue(this.plugin.settings.username)
				.onChange(async (value) => {
					this.plugin.settings.username = value;
					await this.plugin.saveSettings();
				}));

		// Password (T017)
		new Setting(containerEl)
			.setName('Password')
			.setDesc('Your CalDAV password or app-specific token')
			.addText(text => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('Enter password')
					.setValue(this.plugin.settings.password)
					.onChange(async (value) => {
						this.plugin.settings.password = value;
						await this.plugin.saveSettings();
					});
			});

		// Calendar Path (T018)
		new Setting(containerEl)
			.setName('Calendar path')
			.setDesc('Path to your tasks calendar (e.g., /dav/calendars/user/tasks/)')
			.addText(text => text
				.setPlaceholder('/dav/calendars/user/tasks/')
				.setValue(this.plugin.settings.calendarPath)
				.onChange(async (value) => {
					this.plugin.settings.calendarPath = value;
					await this.plugin.saveSettings();
				}));

		// Test Connection Button (T020-T022)
		new Setting(containerEl)
			.setName('Test connection')
			.setDesc('Verify your CalDAV connection settings')
			.addButton(button => button
				.setButtonText('Test connection')
				.setCta()
				.onClick(async () => {
					await this.testConnection();
				}));
	}

	/**
	 * Add sync settings section (US5: T024-T032)
	 * Extended for US2: T017-T018 (002-sync-polish)
	 */
	private addSyncSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Sync Settings' });

		// Enable Auto-Sync Toggle (T026)
		new Setting(containerEl)
			.setName('Enable automatic sync')
			.setDesc('Automatically sync tasks at regular intervals')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAutoSync)
				.onChange(async (value) => {
					this.plugin.settings.enableAutoSync = value;
					await this.plugin.saveSettings();

					// Restart sync scheduler if needed
					if (this.plugin.syncScheduler) {
						if (value) {
							this.plugin.syncScheduler.start();
						} else {
							this.plugin.syncScheduler.stop();
						}
					}
				}));

		// Sync Interval (T025)
		new Setting(containerEl)
			.setName('Sync interval')
			.setDesc('Time between automatic syncs (minimum 10 seconds)')
			.addText(text => text
				.setPlaceholder('60')
				.setValue(String(this.plugin.settings.syncInterval))
				.onChange(async (value) => {
					const interval = parseInt(value);
					if (interval >= 10) {
						this.plugin.settings.syncInterval = interval;
						await this.plugin.saveSettings();

						// Restart sync scheduler with new interval
						if (this.plugin.syncScheduler) {
							this.plugin.syncScheduler.stop();
							this.plugin.syncScheduler.start();
						}
					} else {
						new Notice('Sync interval must be at least 10 seconds');
					}
				}));

		// Debug Logging Toggle (T017-T018, 002-sync-polish)
		new Setting(containerEl)
			.setName('Enable debug logging')
			.setDesc('Show detailed sync logs in browser console (open with F12). Disable for minimal output.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableDebugLogging)
				.onChange(async (value) => {
					this.plugin.settings.enableDebugLogging = value;
					setDebugMode(value);
					await this.plugin.saveSettings();
				}));
	}

	/**
	 * Add filter settings section (US6: T061-T064, T070)
	 */
	private addFilterSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Filter Settings' });

		// Info about filter logic
		const infoEl = containerEl.createDiv({ cls: 'setting-item-description' });
		infoEl.createEl('p', {
			text: 'Tasks that match any exclusion filter will not be synced to CalDAV.'
		});

		// Excluded Folders (T062 with validation T070)
		new Setting(containerEl)
			.setName('Excluded folders')
			.setDesc('Comma-separated list of folders to exclude (must end with /). Example: Archive/, Templates/')
			.addText(text => text
				.setPlaceholder('Archive/, Templates/')
				.setValue(this.plugin.settings.excludedFolders.join(', '))
				.onChange(async (value) => {
					// Parse and validate folder paths (T070)
					const folders = value
						.split(',')
						.map(f => f.trim())
						.filter(f => f.length > 0);

					// Validate: all folders must end with '/'
					const invalidFolders = folders.filter(f => !f.endsWith('/'));
					if (invalidFolders.length > 0) {
						new Notice(`Invalid folder paths (must end with /): ${invalidFolders.join(', ')}`);
						return;
					}

					this.plugin.settings.excludedFolders = folders;
					await this.plugin.saveSettings();

					// Update filter in sync engine
					this.updateSyncFilter();
				}));

		// Excluded Tags (T063 with validation T070)
		new Setting(containerEl)
			.setName('Excluded tags')
			.setDesc('Comma-separated list of tags to exclude (must start with #). Example: #private, #local-only')
			.addText(text => text
				.setPlaceholder('#private, #local-only')
				.setValue(this.plugin.settings.excludedTags.join(', '))
				.onChange(async (value) => {
					// Parse and validate tags (T070)
					const tags = value
						.split(',')
						.map(t => t.trim())
						.filter(t => t.length > 0);

					// Validate: all tags must start with '#'
					const invalidTags = tags.filter(t => !t.startsWith('#'));
					if (invalidTags.length > 0) {
						new Notice(`Invalid tags (must start with #): ${invalidTags.join(', ')}`);
						return;
					}

					this.plugin.settings.excludedTags = tags;
					await this.plugin.saveSettings();

					// Update filter in sync engine
					this.updateSyncFilter();
				}));

		// Completed Task Age Threshold (T064)
		new Setting(containerEl)
			.setName('Completed task age')
			.setDesc('Exclude completed tasks older than this many days (0 = sync all completed tasks)')
			.addText(text => text
				.setPlaceholder('30')
				.setValue(String(this.plugin.settings.completedTaskAgeDays))
				.onChange(async (value) => {
					const days = parseInt(value);
					if (isNaN(days) || days < 0) {
						new Notice('Completed task age must be 0 or greater');
						return;
					}

					this.plugin.settings.completedTaskAgeDays = days;
					await this.plugin.saveSettings();

					// Update filter in sync engine
					this.updateSyncFilter();
				}));
	}

	/**
	 * Update sync filter when settings change
	 */
	private updateSyncFilter(): void {
		// Reinitialize sync engine's filter if engine exists
		if (this.plugin.syncEngine) {
			this.plugin.syncEngine.updateFilter();
		}
	}

	/**
	 * Test connection to CalDAV server (T020-T022)
	 */
	private async testConnection(): Promise<void> {
		// Validate settings
		if (!this.plugin.settings.serverUrl) {
			new Notice('Please enter a server URL');
			return;
		}

		if (!this.plugin.settings.serverUrl.startsWith('https://')) {
			new Notice('Server URL must start with https://');
			return;
		}

		if (!this.plugin.settings.username || !this.plugin.settings.password) {
			new Notice('Please enter username and password');
			return;
		}

		const notice = new Notice('Testing connection...', 0);

		try {
			const client = new CalDAVClient(this.plugin.settings);
			const success = await client.testConnection();

			notice.hide();

			if (success) {
				new Notice('✓ Connection successful!');
			} else {
				new Notice('✗ Connection failed. Please check your settings.');
			}
		} catch (error) {
			notice.hide();

			if (error instanceof CalDAVAuthError) {
				new Notice('✗ Authentication failed. Please check your username and password.');
			} else if (error instanceof CalDAVNetworkError) {
				new Notice('✗ Network error. Please check your server URL and internet connection.');
			} else if (error instanceof Error) {
				new Notice(`✗ Connection failed: ${error.message}`);
			} else {
				new Notice('✗ Connection failed. Please check your settings.');
			}
		}
	}
}

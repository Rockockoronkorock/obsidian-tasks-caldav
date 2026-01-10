/**
 * Notification utilities for sync operations
 * Implements US5: T031-T032
 */

import { Notice, Modal, App } from 'obsidian';

/**
 * Show sync start notification
 */
export function showSyncStart(): void {
	new Notice('Syncing tasks...', 2000);
}

/**
 * Show sync success notification
 * @param taskCount Number of tasks synced
 */
export function showSyncSuccess(taskCount: number): void {
	new Notice(`✓ Synced ${taskCount} task${taskCount !== 1 ? 's' : ''}`);
}

/**
 * Show sync error notification
 * @param app The Obsidian app instance
 * @param error Error message
 * @param isAutoSync Whether this was an automatic sync
 */
export function showSyncError(app: App, error: string, isAutoSync: boolean = false): void {
	if (isAutoSync) {
		// For automatic sync errors, show modal to be more visible
		new SyncErrorModal(app, error).open();
	} else {
		// For manual sync errors, show notice
		new Notice(`✗ Sync failed: ${error}`, 5000);
	}
}

/**
 * Modal for displaying automatic sync errors
 */
class SyncErrorModal extends Modal {
	error: string;

	constructor(app: App, error: string) {
		super(app);
		this.error = error;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Automatic Sync Error' });
		contentEl.createEl('p', { text: 'An error occurred during automatic sync:' });
		contentEl.createEl('p', { text: this.error, cls: 'mod-error' });
		contentEl.createEl('p', { text: 'Please check your CalDAV connection settings.' });

		const buttonDiv = contentEl.createDiv({ cls: 'modal-button-container' });
		const closeButton = buttonDiv.createEl('button', { text: 'Close' });
		closeButton.onclick = () => this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

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
 * @param message Success message or task count
 */
export function showSyncSuccess(message: string | number): void {
	if (typeof message === 'number') {
		new Notice(`✓ Synced ${message} task${message !== 1 ? 's' : ''}`);
	} else {
		new Notice(`✓ ${message}`);
	}
}

/**
 * Show sync error notification
 * @param error Error message
 * @param details Array of detailed error messages
 * @param app Optional app instance for modal errors
 * @param isAutoSync Whether this was an automatic sync
 */
export function showSyncError(error: string, details: string[] = [], app?: App, isAutoSync: boolean = false): void {
	if (isAutoSync && app) {
		// For automatic sync errors, show modal to be more visible
		new SyncErrorModal(app, error, details).open();
	} else {
		// For manual sync errors, show notice
		let errorMsg = `✗ ${error}`;
		if (details.length > 0 && details.length <= 3) {
			// Show first few errors inline
			errorMsg += '\n' + details.slice(0, 3).join('\n');
		}
		new Notice(errorMsg, 8000);
	}
}

/**
 * Modal for displaying automatic sync errors
 */
class SyncErrorModal extends Modal {
	error: string;
	details: string[];

	constructor(app: App, error: string, details: string[] = []) {
		super(app);
		this.error = error;
		this.details = details;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Automatic Sync Error' });
		contentEl.createEl('p', { text: 'An error occurred during automatic sync:' });
		contentEl.createEl('p', { text: this.error, cls: 'mod-error' });

		if (this.details.length > 0) {
			contentEl.createEl('p', { text: 'Details:' });
			const detailsList = contentEl.createEl('ul');
			this.details.forEach(detail => {
				detailsList.createEl('li', { text: detail, cls: 'mod-warning' });
			});
		}

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

/**
 * Settings Tab Contract
 *
 * Defines the UI addition in `src/ui/settingsTab.ts` for the hyperlink
 * sync mode dropdown.
 *
 * Module: src/ui/settingsTab.ts (existing file — one addition in addSyncSection)
 */

import { HyperlinkSyncMode } from '../../../src/types';

// ============================================================================
// New Setting: Hyperlink handling dropdown
// ============================================================================

/**
 * Add a dropdown setting at the END of the `addSyncSection()` method,
 * after the existing "Enable debug logging" toggle (currently the last
 * item in that section, around line 194).
 *
 * Placement rationale:
 *   - This setting governs sync behavior → belongs in "Sync" section
 *   - Placed after debug logging (a meta-setting) so it reads as:
 *       Enable auto-sync
 *       Sync interval
 *       Enable debug logging
 *       Hyperlink handling          ← NEW
 *
 * UI copy (sentence case per Constitution Principle V):
 *   Name: "Hyperlink handling"
 *   Description: "How markdown hyperlinks [text](url) in task descriptions
 *                  are handled when syncing to CalDAV"
 *
 * Dropdown options (order matters — matches priority in spec):
 *   "Keep as-is"     → HyperlinkSyncMode.Keep
 *   "Move to notes"  → HyperlinkSyncMode.Move
 *   "Strip hyperlinks" → HyperlinkSyncMode.Strip
 *
 * @example
 * ```typescript
 * // Append to addSyncSection(), after the debug logging toggle:
 *
 * new Setting(containerEl)
 *   .setName("Hyperlink handling")
 *   .setDesc("How markdown hyperlinks [text](url) in task descriptions are handled when syncing to CalDAV")
 *   .addDropdown((dropdown) =>
 *     dropdown
 *       .addOption(HyperlinkSyncMode.Keep,  "Keep as-is")
 *       .addOption(HyperlinkSyncMode.Move,  "Move to notes")
 *       .addOption(HyperlinkSyncMode.Strip, "Strip hyperlinks")
 *       .setValue(this.plugin.settings.hyperlinkSyncMode)
 *       .onChange(async (value) => {
 *         this.plugin.settings.hyperlinkSyncMode = value as HyperlinkSyncMode;
 *         await this.plugin.saveSettings();
 *       })
 *   );
 * ```
 *
 * Notes:
 *   - No restart or re-sync required after change (FR-009: applies on next sync)
 *   - No updateSyncFilter() call needed — this setting is not a filter;
 *     it is read directly by the sync engine at processing time
 *   - Import HyperlinkSyncMode at top of settingsTab.ts:
 *       import { ..., HyperlinkSyncMode } from "../types";
 */
interface SettingsTabModification {
  section: 'addSyncSection';
  position: 'end';
  controlType: 'dropdown';
  linesAdded: 13;  // new Setting block
  linesRemoved: 0;
  breakingChange: false;
}

// ============================================================================
// Testing Contract
// ============================================================================

/**
 * Manual test scenarios for the settings UI:
 *
 * 1. Default state: dropdown shows "Keep as-is" on fresh install
 * 2. Select "Move to notes" → persists across plugin reload
 * 3. Select "Strip hyperlinks" → persists across plugin reload
 * 4. Revert to "Keep as-is" → persists across plugin reload
 * 5. Verify setting is in the "Sync" section (not "Filters" or "Connection")
 */

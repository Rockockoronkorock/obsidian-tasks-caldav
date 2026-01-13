/**
 * Conflict resolution for bidirectional sync
 * Based on tasks.md T057 specification
 * Uses last-write-wins strategy based on modification timestamps
 */

import { Task, CalDAVTask, SyncMapping, TaskStatus } from "../types";

/**
 * Represents the resolution of a sync conflict
 */
export interface ConflictResolution {
	/** Which side wins: 'obsidian' or 'caldav' */
	winner: 'obsidian' | 'caldav';
	/** Human-readable reason for the resolution */
	reason: string;
	/** Timestamp of the winning side */
	winningTimestamp: Date;
	/** Timestamp of the losing side */
	losingTimestamp: Date;
}

/**
 * Resolve a conflict between Obsidian and CalDAV versions of a task
 * Implements T057: Last-write-wins conflict resolution
 *
 * @param obsidianTask The task from Obsidian vault
 * @param caldavTask The task from CalDAV server
 * @param mapping The sync mapping with last known timestamps
 * @returns Resolution indicating which side should be used
 */
export function resolveConflict(
	obsidianTask: Task,
	caldavTask: CalDAVTask,
	mapping: SyncMapping
): ConflictResolution {
	// Get timestamps for comparison
	// For Obsidian, we use the last known modification time stored in mapping
	// (we don't have file modification times readily available)
	const obsidianModified = mapping.lastKnownObsidianModified;
	const caldavModified = caldavTask.lastModified;

	// Compare timestamps - last write wins
	if (caldavModified.getTime() > obsidianModified.getTime()) {
		// CalDAV was modified more recently
		return {
			winner: 'caldav',
			reason: `CalDAV version is newer (modified ${caldavModified.toISOString()})`,
			winningTimestamp: caldavModified,
			losingTimestamp: obsidianModified
		};
	} else if (obsidianModified.getTime() > caldavModified.getTime()) {
		// Obsidian was modified more recently
		return {
			winner: 'obsidian',
			reason: `Obsidian version is newer (modified ${obsidianModified.toISOString()})`,
			winningTimestamp: obsidianModified,
			losingTimestamp: caldavModified
		};
	} else {
		// Timestamps are equal - prefer Obsidian as the source of truth
		return {
			winner: 'obsidian',
			reason: `Timestamps equal (${obsidianModified.toISOString()}), preferring Obsidian`,
			winningTimestamp: obsidianModified,
			losingTimestamp: caldavModified
		};
	}
}

/**
 * Format a conflict resolution for logging
 * Implements T060: Conflict resolution logging
 *
 * @param resolution The conflict resolution
 * @param taskDescription Description of the task for context
 * @returns Formatted log message
 */
export function formatConflictLog(
	resolution: ConflictResolution,
	taskDescription: string
): string {
	const timeDiff = Math.abs(
		resolution.winningTimestamp.getTime() - resolution.losingTimestamp.getTime()
	);
	const secondsDiff = Math.round(timeDiff / 1000);

	return [
		`Conflict resolved for task: "${taskDescription}"`,
		`  Winner: ${resolution.winner.toUpperCase()}`,
		`  Reason: ${resolution.reason}`,
		`  Time difference: ${secondsDiff} seconds`
	].join('\n');
}

/**
 * Check if a conflict exists between Obsidian and CalDAV versions
 * A conflict exists if both sides have been modified since the last sync
 *
 * @param obsidianChanged Whether Obsidian version has changed
 * @param caldavChanged Whether CalDAV version has changed
 * @returns true if both sides have changed (conflict)
 */
export function hasConflict(
	obsidianChanged: boolean,
	caldavChanged: boolean
): boolean {
	return obsidianChanged && caldavChanged;
}

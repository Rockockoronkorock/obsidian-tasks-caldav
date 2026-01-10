import { Task, SyncMapping, SerializedSyncMapping } from '../types';

/**
 * Sync mapping management and content hashing utilities
 * Based on data-model.md specification
 */

/**
 * Compute content hash for change detection
 * @param task The task to hash
 * @returns Hash string
 */
export function hashTaskContent(task: Task): string {
	const content = `${task.description}|${task.dueDate?.toISOString() ?? 'null'}|${task.status}`;

	// Simple string hash (djb2 algorithm)
	let hash = 5381;
	for (let i = 0; i < content.length; i++) {
		hash = ((hash << 5) + hash) + content.charCodeAt(i);
		hash = hash & hash; // Convert to 32-bit integer
	}

	return hash.toString(36);
}

/**
 * In-memory storage for sync mappings
 */
const mappings: Map<string, SyncMapping> = new Map();

/**
 * Load mappings from serialized format
 * @param serializedMappings Record of serialized mappings
 */
export function loadMappings(serializedMappings: Record<string, SerializedSyncMapping>): void {
	mappings.clear();

	for (const [blockId, serialized] of Object.entries(serializedMappings)) {
		const mapping: SyncMapping = {
			blockId: serialized.blockId,
			caldavUid: serialized.caldavUid,
			lastSyncTimestamp: new Date(serialized.lastSyncTimestamp),
			lastKnownContentHash: serialized.lastKnownContentHash,
			lastKnownObsidianModified: new Date(serialized.lastKnownObsidianModified),
			lastKnownCalDAVModified: new Date(serialized.lastKnownCalDAVModified)
		};

		mappings.set(blockId, mapping);
	}
}

/**
 * Save mappings to serialized format
 * @returns Record of serialized mappings
 */
export function saveMappings(): Record<string, SerializedSyncMapping> {
	const serialized: Record<string, SerializedSyncMapping> = {};

	for (const [blockId, mapping] of mappings.entries()) {
		serialized[blockId] = {
			blockId: mapping.blockId,
			caldavUid: mapping.caldavUid,
			lastSyncTimestamp: mapping.lastSyncTimestamp.toISOString(),
			lastKnownContentHash: mapping.lastKnownContentHash,
			lastKnownObsidianModified: mapping.lastKnownObsidianModified.toISOString(),
			lastKnownCalDAVModified: mapping.lastKnownCalDAVModified.toISOString()
		};
	}

	return serialized;
}

/**
 * Get mapping by block ID
 * @param blockId The block ID to look up
 * @returns Sync mapping or undefined if not found
 */
export function getMappingByBlockId(blockId: string): SyncMapping | undefined {
	return mappings.get(blockId);
}

/**
 * Set or update a mapping
 * @param mapping The mapping to store
 */
export function setMapping(mapping: SyncMapping): void {
	mappings.set(mapping.blockId, mapping);
}

/**
 * Remove a mapping
 * @param blockId The block ID to remove
 */
export function removeMapping(blockId: string): void {
	mappings.delete(blockId);
}

/**
 * Get all mappings
 * @returns Map of all sync mappings
 */
export function getAllMappings(): Map<string, SyncMapping> {
	return mappings;
}

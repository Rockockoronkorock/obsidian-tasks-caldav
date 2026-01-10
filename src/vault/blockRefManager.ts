/**
 * Block reference ID generation and management
 * Based on research.md decision: UUID v4 using crypto.randomUUID()
 */

/**
 * Generate a stable task block ID using UUID v4
 * Format: task-[uuid]
 * @returns Block ID string (e.g., "task-a1b2c3d4-e5f6-7890-abcd-ef1234567890")
 */
export function generateTaskBlockId(): string {
	// Use native crypto API (available in Obsidian's Electron environment)
	const uuid = crypto.randomUUID();
	return `task-${uuid}`;
}

/**
 * Extract block ID from a task line
 * @param line The task line to parse
 * @returns Block ID or null if not found
 */
export function extractBlockId(line: string): string | null {
	// Match block reference pattern: ^task-[uuid]
	const match = line.match(/\^(task-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
	return match?.[1] ?? null;
}

/**
 * Check if a task line has a block ID
 * @param line The task line to check
 * @returns true if line contains a block ID
 */
export function hasBlockId(line: string): boolean {
	return extractBlockId(line) !== null;
}

/**
 * Embed a block ID into a task line
 * @param line The task line
 * @param blockId The block ID to embed
 * @returns Task line with embedded block ID
 */
export function embedBlockId(line: string, blockId: string): string {
	// If line already has a block ID, return as-is
	if (hasBlockId(line)) {
		return line;
	}

	// Append block ID to end of line (before newline if present)
	const trimmedLine = line.trimEnd();
	return `${trimmedLine} ^${blockId}`;
}

/**
 * Validate block ID format
 * @param blockId The block ID to validate
 * @returns true if valid format
 */
export function isValidBlockId(blockId: string): boolean {
	const pattern = /^task-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
	return pattern.test(blockId);
}

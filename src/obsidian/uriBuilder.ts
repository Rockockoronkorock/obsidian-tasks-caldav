/**
 * URI Builder Service
 * Generates Obsidian deep links from task metadata.
 */

// Regular expression for validating block ID format: task-{uuid}
const BLOCK_ID_REGEX = /^task-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Validates that a block ID matches the expected UUID format.
 *
 * Valid format: "task-" followed by a UUID v4 (lowercase hex with dashes)
 * Example: "task-a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *
 * @param blockId - The block ID to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidBlockId("task-a1b2c3d4-e5f6-7890-abcd-ef1234567890")  // true
 * isValidBlockId("task-invalid")                               // false
 * isValidBlockId("")                                           // false
 * ```
 */
export function isValidBlockId(blockId: string): boolean {
	return BLOCK_ID_REGEX.test(blockId);
}

/**
 * Builds a fully formatted Obsidian URI for opening a specific task.
 *
 * Constructs a deep link in the format:
 * `obsidian://open?vault={VaultName}&file={FilePath}&block={BlockID}`
 *
 * @param vaultName - The name of the Obsidian vault (from vault.getName())
 * @param filePath - Vault-relative file path (e.g., "Projects/tasks.md")
 * @param blockId - Task block identifier (format: "task-{uuid}")
 * @returns Fully formatted Obsidian URI
 * @throws Error if blockId is invalid or if vaultName/filePath are empty
 *
 * @example
 * ```typescript
 * buildObsidianURI("My Vault", "Projects/tasks.md", "task-abc123...")
 * // Returns: "obsidian://open?vault=My%20Vault&file=Projects%2Ftasks.md&block=task-abc123..."
 * ```
 */
export function buildObsidianURI(
	vaultName: string,
	filePath: string,
	blockId: string
): string {
	// Validate inputs
	if (!vaultName || vaultName.trim() === '') {
		throw new Error('Vault name is required');
	}
	if (!filePath || filePath.trim() === '') {
		throw new Error('File path is required');
	}
	if (!blockId || !isValidBlockId(blockId)) {
		throw new Error('Invalid block ID format');
	}

	// URL-encode components (blockId doesn't need encoding - UUID-safe)
	const encodedVault = encodeURIComponent(vaultName);
	const encodedFile = encodeURIComponent(filePath);

	// Construct URI
	return `obsidian://open?vault=${encodedVault}&file=${encodedFile}&block=${blockId}`;
}

/**
 * Builds the DESCRIPTION field content with Obsidian URI appended.
 *
 * Formats the URI with a human-readable label for display in CalDAV clients.
 * Uses two newlines for visual separation from any existing content.
 *
 * @param uri - The Obsidian URI (from buildObsidianURI)
 * @param existingContent - Optional existing DESCRIPTION content to preserve
 * @returns Formatted DESCRIPTION field value (NOT yet RFC 5545 escaped)
 *
 * @example
 * ```typescript
 * buildDescriptionWithURI("obsidian://open?vault=...")
 * // Returns: "\n\nObsidian Link: obsidian://open?vault=..."
 * ```
 *
 * @remarks
 * Caller must apply RFC 5545 TEXT escaping before embedding in VTODO.
 */
export function buildDescriptionWithURI(
	uri: string,
	existingContent?: string
): string {
	if (existingContent) {
		return `${existingContent}\n\nObsidian Link: ${uri}`;
	}
	return `\n\nObsidian Link: ${uri}`;
}

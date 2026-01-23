/**
 * URI Builder Contract
 *
 * Service responsible for generating Obsidian deep links from task metadata.
 * This module provides pure functions with no side effects or external dependencies.
 *
 * Module: src/obsidian/uriBuilder.ts (new file)
 */

// ============================================================================
// Public API
// ============================================================================

/**
 * Builds a fully formatted Obsidian URI for opening a specific task.
 *
 * @param vaultName - The name of the Obsidian vault (from vault.getName())
 * @param filePath - Vault-relative file path (e.g., "Projects/tasks.md")
 * @param blockId - Task block identifier (format: "task-{uuid}")
 * @returns Fully formatted Obsidian URI
 * @throws Error if blockId is invalid or if vaultName/filePath are empty
 *
 * @example
 * buildObsidianURI("My Vault", "Projects/tasks.md", "task-abc123...")
 * // Returns: "obsidian://open?vault=My%20Vault&file=Projects%2Ftasks.md&block=task-abc123..."
 *
 * @example Error cases
 * buildObsidianURI("", "file.md", "task-123")  // throws: "Vault name is required"
 * buildObsidianURI("Vault", "", "task-123")    // throws: "File path is required"
 * buildObsidianURI("Vault", "file.md", "")     // throws: "Invalid block ID"
 * buildObsidianURI("Vault", "file.md", "bad")  // throws: "Invalid block ID"
 */
export function buildObsidianURI(
  vaultName: string,
  filePath: string,
  blockId: string
): string;

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
 * buildDescriptionWithURI("obsidian://open?vault=...")
 * // Returns: "\n\nObsidian Link: obsidian://open?vault=..."
 *
 * @example With existing content (future enhancement)
 * buildDescriptionWithURI("obsidian://...", "Task notes here")
 * // Returns: "Task notes here\n\nObsidian Link: obsidian://..."
 *
 * @note Caller must apply RFC 5545 TEXT escaping before embedding in VTODO
 */
export function buildDescriptionWithURI(
  uri: string,
  existingContent?: string
): string;

// ============================================================================
// Validation API (Internal)
// ============================================================================

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
 * isValidBlockId("task-a1b2c3d4-e5f6-7890-abcd-ef1234567890")  // true
 * isValidBlockId("task-invalid")                               // false
 * isValidBlockId("")                                           // false
 * isValidBlockId("a1b2c3d4-...")                               // false (missing "task-" prefix)
 *
 * @note This function is used internally by buildObsidianURI for validation
 */
export function isValidBlockId(blockId: string): boolean;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Components required to build an Obsidian URI.
 * This is a conceptual type; components are passed separately to buildObsidianURI.
 */
export interface ObsidianURIComponents {
  /** Vault name from Obsidian API (vault.getName()) */
  vaultName: string;

  /** Vault-relative file path (e.g., "Projects/Work/tasks.md") */
  filePath: string;

  /** Task block identifier (format: "task-{uuid}") */
  blockId: string;
}

/**
 * Error types thrown by the URI builder.
 */
export type URIBuilderError =
  | { type: 'EMPTY_VAULT_NAME'; message: 'Vault name is required' }
  | { type: 'EMPTY_FILE_PATH'; message: 'File path is required' }
  | { type: 'INVALID_BLOCK_ID'; message: 'Invalid block ID format' };

// ============================================================================
// Implementation Notes
// ============================================================================

/**
 * URL Encoding Strategy:
 * - vaultName: encodeURIComponent() - handles spaces, special chars, Unicode
 * - filePath: encodeURIComponent() - same encoding as vault name
 * - blockId: NO encoding needed (UUID format is URI-safe: a-z 0-9 -)
 *
 * RFC 5545 Escaping:
 * - NOT applied in this module
 * - Caller (CalDAV client) must apply escapeText() before embedding in VTODO
 * - Escaping rules: backslash, semicolon, comma, newline
 *
 * Performance:
 * - Target: <5ms per call
 * - No I/O operations
 * - Minimal string operations: 2 encodeURIComponent() calls + 1 template literal
 *
 * Error Handling:
 * - Throws Error for invalid inputs (caller should validate before calling)
 * - Alternative: Return Option<string> type for graceful degradation
 *   → Decision: Throw errors (caller uses try-catch for error logging)
 *
 * Testing:
 * - Unit testable: pure functions with no dependencies
 * - Test cases:
 *   - Normal paths (ASCII, Unicode, spaces, special chars)
 *   - Edge cases (empty strings, very long paths, malformed block IDs)
 *   - URL encoding validation (verify percent-encoding correctness)
 */

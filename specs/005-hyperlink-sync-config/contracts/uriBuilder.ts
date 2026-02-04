/**
 * URI Builder Modification Contract
 *
 * Defines the change to `src/obsidian/uriBuilder.ts` — specifically the
 * `buildDescriptionWithURI()` function which must be updated to support
 * prepending an existing content block (the extracted hyperlinks) before
 * the Obsidian Link.
 *
 * Module: src/obsidian/uriBuilder.ts (existing file — one function modified)
 */

// ============================================================================
// Modified Function: buildDescriptionWithURI
// ============================================================================

/**
 * Current implementation (uriBuilder.ts:90-97):
 *
 * ```typescript
 * export function buildDescriptionWithURI(
 *   uri: string,
 *   existingContent?: string
 * ): string {
 *   // For initial implementation, assume no existing content
 *   // Future enhancement: preserve existing content if present
 *   return `\n\nObsidian Link: ${uri}`;
 * }
 * ```
 *
 * Required change: honour the `existingContent` parameter. When non-empty,
 * prepend it before the Obsidian Link with a blank-line separator.
 *
 * New implementation:
 * ```typescript
 * export function buildDescriptionWithURI(
 *   uri: string,
 *   existingContent?: string
 * ): string {
 *   if (existingContent) {
 *     return `${existingContent}\n\nObsidian Link: ${uri}`;
 *   }
 *   return `\n\nObsidian Link: ${uri}`;
 * }
 * ```
 *
 * Output format examples:
 *
 *   No existingContent:
 *     "\n\nObsidian Link: obsidian://open?vault=..."
 *
 *   With existingContent (hyperlinks block from feature 005):
 *     "Links:\n- brief: https://example.com/brief\n\nObsidian Link: obsidian://open?vault=..."
 *
 * Backward compatibility:
 *   - Callers that don't pass existingContent (or pass undefined) get the
 *     exact same output as before. No change to feature 003 behavior.
 *   - The sync engine for feature 005 passes `processed.extractedLinksBlock`
 *     as existingContent when it is non-empty.
 *
 * Note: The existing comment "Future enhancement: preserve existing content
 * if present" is removed — this IS that enhancement.
 */
interface BuildDescriptionWithURIModification {
  function: 'buildDescriptionWithURI';
  changeType: 'LOGIC_FIX';  // Was a TODO/stub; now implemented
  linesAdded: 3;   // if-block with return
  linesRemoved: 2; // comment lines
  breakingChange: false;
  backwardCompatible: true;
}

// ============================================================================
// Unchanged Functions
// ============================================================================

/**
 * buildObsidianURI(): NO CHANGES
 *   URI generation logic is independent of hyperlink handling.
 *
 * isValidBlockId(): NO CHANGES
 *   Block ID validation is unchanged.
 */

// ============================================================================
// Testing Contract
// ============================================================================

/**
 * Test scenarios for the modified buildDescriptionWithURI:
 *
 * 1. uri provided, no existingContent → "\n\nObsidian Link: {uri}"
 *    (existing behavior, regression test)
 *
 * 2. uri provided, existingContent = "Links:\n- text: url"
 *    → "Links:\n- text: url\n\nObsidian Link: {uri}"
 *
 * 3. uri provided, existingContent = "" (empty string)
 *    → "\n\nObsidian Link: {uri}"  (empty string is falsy, treated as no content)
 *
 * 4. uri provided, existingContent = undefined
 *    → "\n\nObsidian Link: {uri}"  (same as no content)
 */

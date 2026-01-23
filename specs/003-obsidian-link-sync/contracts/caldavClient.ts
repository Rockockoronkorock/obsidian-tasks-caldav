/**
 * CalDAV Client Integration Contract
 *
 * Defines modifications to the CalDAV client for DESCRIPTION field support.
 * This contract documents changes to src/caldav/client.ts and src/caldav/vtodo.ts.
 *
 * Module: src/caldav/client.ts (existing file - minimal modifications)
 */

// ============================================================================
// Modified Method: createTask
// ============================================================================

/**
 * Creates a new task (VTODO) on the CalDAV server.
 *
 * MODIFICATIONS:
 * 1. Add optional `description` parameter
 * 2. Pass description to VTODO construction logic
 * 3. Include DESCRIPTION field in generated VTODO if provided
 *
 * @param vtodoData - The base VTODO properties (SUMMARY, STATUS, DUE)
 * @param description - Optional DESCRIPTION field content (with Obsidian URI)
 * @returns Promise resolving to created task metadata (UID, href, etag)
 * @throws Error if CalDAV server returns error response
 *
 * @example Before (existing implementation)
 * ```typescript
 * async createTask(vtodoData: VTODOData): Promise<CalDAVTaskMetadata> {
 *   const vtodo = this.buildVTODO(vtodoData);
 *   const response = await this.sendRequest('PUT', href, vtodo);
 *   return { uid, href, etag };
 * }
 * ```
 *
 * @example After (with optional description)
 * ```typescript
 * async createTask(
 *   vtodoData: VTODOData,
 *   description?: string  // NEW parameter
 * ): Promise<CalDAVTaskMetadata> {
 *   const vtodo = this.buildVTODO(vtodoData, description);  // Pass to builder
 *   const response = await this.sendRequest('PUT', href, vtodo);
 *   return { uid, href, etag };
 * }
 * ```
 */
interface CreateTaskModification {
  method: 'createTask';
  changeType: 'SIGNATURE_EXTENSION';
  linesAdded: 1;  // Parameter addition
  linesRemoved: 0;
  breakingChange: false;  // Backward compatible (optional parameter)
}

// ============================================================================
// Modified Helper: buildVTODO (or inline VTODO construction)
// ============================================================================

/**
 * Builds the iCalendar VTODO string with optional DESCRIPTION field.
 *
 * MODIFICATIONS:
 * 1. Accept optional description parameter
 * 2. If description provided, apply RFC 5545 TEXT escaping
 * 3. Include DESCRIPTION field in VTODO output
 *
 * @param vtodoData - Base task properties (summary, status, due)
 * @param description - Optional DESCRIPTION content (NOT yet escaped)
 * @returns iCalendar VTODO string
 *
 * @example VTODO structure without DESCRIPTION (current)
 * ```
 * BEGIN:VTODO
 * UID:some-uuid
 * SUMMARY:Task description
 * STATUS:NEEDS-ACTION
 * END:VTODO
 * ```
 *
 * @example VTODO structure with DESCRIPTION (new)
 * ```
 * BEGIN:VTODO
 * UID:some-uuid
 * SUMMARY:Task description
 * DESCRIPTION:\n\nObsidian Link: obsidian://open?vault=...
 * STATUS:NEEDS-ACTION
 * END:VTODO
 * ```
 *
 * @note DESCRIPTION field is inserted after SUMMARY, before STATUS
 * @note RFC 5545 escaping is applied to DESCRIPTION value
 */
interface BuildVTODOModification {
  method: 'buildVTODO' | 'inline VTODO construction';
  changeType: 'CONDITIONAL_FIELD_ADDITION';
  linesAdded: 5;  // if (description) { ... }
  linesRemoved: 0;
  implementation: `
    if (description) {
      const escapedDesc = escapeText(description);
      vtodoString += \`DESCRIPTION:\${escapedDesc}\\n\`;
    }
  `;
}

// ============================================================================
// Unchanged Methods (Property Preservation)
// ============================================================================

/**
 * updateTaskWithPreservation: NO CHANGES NEEDED
 *
 * Rationale: This method already implements the read-before-write pattern:
 * 1. Fetches existing VTODO from server via fetchTaskRawData()
 * 2. Calls updateVTODOProperties() to merge updates
 * 3. Sends updated VTODO back to server
 *
 * The updateVTODOProperties() function preserves all fields except
 * SUMMARY, STATUS, DUE, LAST-MODIFIED, DTSTAMP. Since DESCRIPTION is
 * not in the update list, it's preserved automatically.
 *
 * Location: src/caldav/vtodo.ts line ~187-274 (approximate)
 */
interface UpdateTaskPreservationNoChange {
  method: 'updateVTODOProperties';
  changeType: 'NONE';
  rationale: 'Already preserves DESCRIPTION field by design';
  fieldsUpdated: ['SUMMARY', 'STATUS', 'DUE', 'LAST-MODIFIED', 'DTSTAMP'];
  fieldsPreserved: ['DESCRIPTION', 'all other fields'];
}

/**
 * Existing property preservation logic (for reference):
 *
 * ```typescript
 * function updateVTODOProperties(
 *   existingVTODO: string,
 *   updates: VTODOUpdates
 * ): string {
 *   // Parse existing VTODO
 *   const parsed = parseVTODO(existingVTODO);
 *
 *   // Update only managed properties
 *   parsed.SUMMARY = updates.summary;
 *   parsed.STATUS = updates.status;
 *   parsed.DUE = updates.due;
 *   parsed['LAST-MODIFIED'] = now();
 *   parsed.DTSTAMP = now();
 *
 *   // DESCRIPTION is NOT touched → preserved automatically
 *
 *   // Reconstruct VTODO with preserved fields
 *   return buildVTODOFromParsed(parsed);
 * }
 * ```
 */

// ============================================================================
// RFC 5545 Text Escaping (Existing Utility)
// ============================================================================

/**
 * Applies RFC 5545 TEXT value escaping to a string.
 *
 * This function already exists in src/caldav/vtodo.ts and will be reused
 * for escaping DESCRIPTION content.
 *
 * @param text - Raw text content
 * @returns Escaped text safe for iCalendar TEXT values
 *
 * Escaping rules (RFC 5545 §3.3.11):
 * - Backslash: \ → \\
 * - Semicolon: ; → \;
 * - Comma: , → \,
 * - Newline: actual newline → \n (literal two characters)
 *
 * @example
 * escapeText("Line 1\nLine 2; note, here")
 * // Returns: "Line 1\\nLine 2\\; note\\, here"
 *
 * Location: src/caldav/vtodo.ts line ~145-164 (approximate)
 */
interface ExistingEscapeTextFunction {
  function: 'escapeText';
  changeType: 'REUSE';
  location: 'src/caldav/vtodo.ts';
  alreadyExists: true;
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Extended method signature for createTask.
 * This documents the new optional parameter.
 */
export interface CalDAVClientCreateTaskSignature {
  /**
   * Original signature:
   * async createTask(vtodoData: string): Promise<{ uid: string; href: string; etag: string }>
   *
   * New signature:
   * async createTask(
   *   vtodoData: string,
   *   description?: string  // ADDED: Optional DESCRIPTION field content
   * ): Promise<{ uid: string; href: string; etag: string }>
   *
   * Backward compatibility: YES (optional parameter)
   * Breaking change: NO
   */
  methodName: 'createTask';
  parameters: [
    { name: 'vtodoData'; type: 'string'; required: true },
    { name: 'description'; type: 'string'; required: false }  // NEW
  ];
  returnType: 'Promise<{ uid: string; href: string; etag: string }>';
}

/**
 * VTODO structure with DESCRIPTION field.
 * This is conceptual - VTODO is generated as a string, not a structured object.
 */
export interface VTODOWithDescription {
  // Standard fields (existing)
  UID: string;
  DTSTAMP: string;
  SUMMARY: string;
  STATUS: 'NEEDS-ACTION' | 'COMPLETED';
  'LAST-MODIFIED': string;
  DUE?: string;  // Optional

  // NEW field (conditionally included)
  DESCRIPTION?: string;  // Present only if Obsidian URI was generated

  // Other fields preserved during updates
  [customField: string]: string | undefined;
}

// ============================================================================
// Testing Contract
// ============================================================================

/**
 * Test scenarios for CalDAV client modifications:
 *
 * 1. Create task WITHOUT description (backward compatibility)
 *    - Call: createTask(vtodoData)
 *    - Expected: VTODO created without DESCRIPTION field (current behavior)
 *
 * 2. Create task WITH description
 *    - Call: createTask(vtodoData, "\n\nObsidian Link: obsidian://...")
 *    - Expected: VTODO includes DESCRIPTION field with escaped content
 *
 * 3. DESCRIPTION content requires escaping
 *    - Input description with special chars: "Link:\nsemicol;comma,"
 *    - Expected: Properly escaped in VTODO: "Link:\\nsemicol\\;comma\\,"
 *
 * 4. Update task preserves DESCRIPTION
 *    - Create task with DESCRIPTION
 *    - Update task via updateTaskWithPreservation()
 *    - Fetch updated task from server
 *    - Expected: DESCRIPTION unchanged, other fields updated
 *
 * 5. CalDAV server compatibility
 *    - Test with multiple servers: Nextcloud, Apple iCloud, Google Calendar
 *    - Expected: DESCRIPTION field accepted and stored correctly
 *
 * Testing method: Manual testing with real CalDAV servers
 */

// ============================================================================
// CalDAV Server Compatibility
// ============================================================================

/**
 * DESCRIPTION field support across CalDAV implementations:
 *
 * RFC 5545 compliance:
 * - DESCRIPTION is a standard property for VTODO (§3.8.1.5)
 * - TEXT value type (allows arbitrary text content)
 * - No length restrictions in spec (server-dependent)
 *
 * Known CalDAV servers:
 * - Nextcloud: Full DESCRIPTION support, no length limits observed
 * - Apple iCloud: Full DESCRIPTION support, renders in Reminders.app
 * - Google Calendar: Full DESCRIPTION support, renders in Tasks
 * - Radicale: Full DESCRIPTION support, minimal VTODO implementation
 * - Baikal: Full DESCRIPTION support
 *
 * Assumptions:
 * - All modern CalDAV servers support DESCRIPTION
 * - Length limits (if any) are adequate for URIs (~100-200 chars)
 * - TEXT escaping is universally supported (RFC 5545 compliance)
 *
 * Edge case (per spec clarification):
 * - If server truncates DESCRIPTION, URI may break (acceptable)
 * - No validation or retry logic needed
 */
export interface CalDAVServerCompatibility {
  supportedServers: [
    'Nextcloud',
    'Apple iCloud',
    'Google Calendar',
    'Radicale',
    'Baikal',
    'Generic RFC 5545 compliant servers'
  ];
  fieldSupport: 'DESCRIPTION is RFC 5545 standard - universally supported';
  lengthLimits: 'No validation - assume servers have adequate limits (1000+ chars)';
  escaping: 'RFC 5545 TEXT escaping required and applied';
}

// ============================================================================
// Implementation Checklist
// ============================================================================

/**
 * Changes to src/caldav/client.ts:
 *
 * [x] Add optional `description` parameter to createTask() signature
 * [x] Pass description to VTODO construction (inline or helper)
 * [x] Apply escapeText() to description before embedding
 * [x] Insert DESCRIPTION field in VTODO string if provided
 *
 * No changes needed:
 * [x] updateTaskWithPreservation() - already preserves DESCRIPTION
 * [x] escapeText() - already exists and works correctly
 * [x] Property preservation logic - already handles DESCRIPTION
 *
 * Testing:
 * [ ] Manual test: Create task with DESCRIPTION
 * [ ] Manual test: Update task, verify DESCRIPTION preserved
 * [ ] Manual test: CalDAV client displays clickable URI
 * [ ] Manual test: Click URI opens Obsidian to correct note
 */

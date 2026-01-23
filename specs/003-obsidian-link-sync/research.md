# Research: Obsidian Link Sync to CalDAV

**Feature**: 003-obsidian-link-sync | **Date**: 2026-01-23

## Overview

This document consolidates research findings for implementing Obsidian URI syncing to CalDAV DESCRIPTION fields. All technical unknowns from the planning phase have been resolved through codebase exploration and standards review.

---

## Decision 1: Obsidian URI Format

**Decision**: Use the standard Obsidian URI scheme with vault, file, and block parameters:
```
obsidian://open?vault={VaultName}&file={FilePath}&block={BlockID}
```

**Rationale**:
- **Standard format**: Documented in Obsidian community resources and widely supported
- **Cross-platform**: Works on Desktop (Windows, macOS, Linux) and Mobile (iOS, Android)
- **Block-level precision**: The `block` parameter navigates directly to the task location, not just the note
- **URL-safe**: Standard query parameter format allows proper encoding of special characters

**Alternatives Considered**:
1. `obsidian://vault/{VaultName}/{FilePath}#{BlockID}` - Not standard, untested fragment support
2. `obsidian://open?path={FilePath}&block={BlockID}` - Missing vault parameter causes ambiguity in multi-vault setups
3. `obsidian://open?file={FilePath}` - Insufficient precision; opens note but doesn't scroll to task

**Implementation Details**:
- Vault name obtained via `this.vault.getName()` (Obsidian API)
- File path is vault-relative (already available in Task object as `task.filePath`)
- Block ID format: `task-{uuid}` (already managed by `blockRefManager.ts`)
- URL encoding required for: file paths with spaces/special chars, vault names with spaces

**Example**:
```
Input:
- Vault: "My Work Vault"
- File: "Projects/Q1 Planning/tasks.md"
- Block: "task-a1b2c3d4-e5f6-7890-abcd-ef1234567890"

Output:
obsidian://open?vault=My%20Work%20Vault&file=Projects%2FQ1%20Planning%2Ftasks.md&block=task-a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

## Decision 2: CalDAV DESCRIPTION Field Usage

**Decision**: Append Obsidian URI to the CalDAV VTODO DESCRIPTION property using the format:
```
{existing content}\n\nObsidian Link: {obsidian URI}
```

**Rationale**:
- **Standard field**: DESCRIPTION is a standard TEXT property in RFC 5545 (iCalendar specification)
- **Widely supported**: All major CalDAV clients (Apple Calendar, Google Calendar, Thunderbird, Outlook) support DESCRIPTION
- **Clickable in most clients**: Modern calendar applications render URLs in DESCRIPTION as clickable links
- **Non-invasive**: Keeps SUMMARY field clean for task text; DESCRIPTION is for extended notes/metadata
- **Preservable**: Existing property preservation pattern in `vtodo.ts:updateVTODOProperties()` already handles DESCRIPTION correctly

**Alternatives Considered**:
1. **SUMMARY field**: Rejected - clutters task title, mixes presentation with metadata
2. **Custom X-OBSIDIAN-URI property**: Rejected - non-standard, not clickable in most clients, requires custom rendering
3. **COMMENT property**: Rejected - less commonly displayed than DESCRIPTION in CalDAV clients
4. **Plain URI without label**: Rejected - less user-friendly; labeled format provides context

**Implementation Details**:
- During initial task creation: append `\n\nObsidian Link: {URI}` to any existing DESCRIPTION content
- Preserve existing content if DESCRIPTION already has notes (future enhancement; current implementation assumes empty)
- Use RFC 5545 TEXT escaping for newlines: `\n` → literal newline in iCalendar format
- Never update DESCRIPTION on subsequent syncs (property preservation handles this automatically)

**CalDAV Client Behavior**:
- **Apple Calendar (macOS/iOS)**: Displays DESCRIPTION in task details, URLs are clickable
- **Google Calendar**: Shows notes field with clickable links
- **Thunderbird**: Displays description with link detection
- **Microsoft Outlook**: Shows task notes with hyperlink support

---

## Decision 3: URL Encoding Strategy

**Decision**: Use JavaScript's `encodeURIComponent()` for vault name and file path components.

**Rationale**:
- **Standard encoding**: `encodeURIComponent()` encodes all characters except: `A-Z a-z 0-9 - _ . ! ~ * ' ( )`
- **URI spec compliant**: Follows RFC 3986 for percent-encoding
- **Handles edge cases**: Spaces, Unicode, special characters (`, @, #, &, =, +, etc.)
- **Built-in**: No external dependencies required

**Alternatives Considered**:
1. **`encodeURI()`**: Insufficient - doesn't encode query parameter reserved chars (`:, /, ?, &, =`)
2. **Custom encoding**: Rejected - reinventing the wheel, error-prone, incomplete coverage
3. **No encoding**: Rejected - breaks on spaces and special characters

**Edge Cases Handled**:
- Spaces: `My Vault` → `My%20Vault`
- Slashes: `Projects/Work` → `Projects%2FWork` (in file path, slashes are kept as-is since they're path separators)
- Special chars: `Tasks & Goals` → `Tasks%20%26%20Goals`
- Unicode: `📁 Archive` → `%F0%9F%93%81%20Archive`

**Implementation**:
```typescript
function buildObsidianURI(vaultName: string, filePath: string, blockId: string): string {
  const encodedVault = encodeURIComponent(vaultName);
  const encodedFile = encodeURIComponent(filePath);
  return `obsidian://open?vault=${encodedVault}&file=${encodedFile}&block=${blockId}`;
}
```

**Note**: Block IDs are UUID-based (`task-{uuid}`) and don't require encoding (only contains: `a-z 0-9 -`).

---

## Decision 4: Integration Point in Sync Flow

**Decision**: Generate and append Obsidian URI during `createTaskOnCalDAV()` in `sync/engine.ts`, immediately before calling `client.createTask()`.

**Rationale**:
- **Single point of creation**: Task creation only happens in one place in the codebase
- **Data availability**: At this point, we have access to Task object (with blockId, filePath) and vault reference
- **Minimal invasiveness**: No changes to task parsing, scanning, or mapping logic
- **Property preservation**: Existing update logic in `updateCalDAVTask()` already preserves DESCRIPTION via read-before-write pattern
- **Clean separation**: URI generation can be isolated in a separate module (`uriBuilder.ts`)

**Alternatives Considered**:
1. **During task parsing**: Too early - not all tasks get synced (filtering, conflicts)
2. **In CalDAV client**: Mixing concerns - client should be transport-only, not business logic
3. **During mapping storage**: Too late - VTODO already created and sent to server
4. **In VTODO conversion**: Possible but requires passing vault context unnecessarily

**Implementation Flow**:
```
syncObsidianToCalDAV()
  └─> handleUntrackedTask(task)
        ├─> addBlockIdToTask(task)              [existing]
        └─> createTaskOnCalDAV(task)             [existing - MODIFY HERE]
              ├─> Get vault name: this.vault.getName()
              ├─> Generate URI: uriBuilder.buildObsidianURI(vaultName, task.filePath, task.blockId)
              ├─> Format description: `\n\nObsidian Link: {uri}`
              ├─> Convert task to VTODO          [existing]
              └─> client.createTask(vtodoData, description) [existing - ADD DESCRIPTION PARAM]
```

**Impact on Update Flow**:
- **No changes needed**: `updateCalDAVTask()` already uses property preservation
- Existing logic: fetch → update only managed fields (SUMMARY, STATUS, DUE) → preserve everything else
- DESCRIPTION field remains untouched after initial creation ✓

---

## Decision 5: Error Handling Strategy

**Decision**: Skip URI generation silently when block ID is missing/malformed; log warnings but allow task sync to continue.

**Rationale**:
- **Graceful degradation**: Absence of URI shouldn't block task syncing (core functionality)
- **Spec compliance**: FR-008 explicitly requires skipping URI generation when block ID is missing/malformed
- **User transparency**: Log warnings so users can investigate if needed, but don't interrupt workflow
- **Existing pattern**: Codebase already uses error logging without throwing for non-critical issues

**Error Scenarios**:
1. **Missing block ID**: Task object has empty/undefined `blockId` field
   - Action: Log warning, sync task without URI
   - Reason: Block ID is essential for accurate linking (per spec clarification)

2. **Invalid vault name**: `vault.getName()` returns empty string (edge case, unlikely)
   - Action: Log error, sync task without URI
   - Reason: Cannot construct valid URI without vault identifier

3. **Empty file path**: Task has empty `filePath` field (should never happen in practice)
   - Action: Log error, sync task without URI
   - Reason: Cannot construct meaningful URI without file location

4. **URL encoding failure**: `encodeURIComponent()` throws (extremely rare)
   - Action: Catch exception, log error, sync task without URI
   - Reason: Encoding failures shouldn't crash sync process

**Implementation Pattern**:
```typescript
try {
  if (!task.blockId || !isValidBlockId(task.blockId)) {
    console.warn(`Skipping URI generation for task: missing or invalid block ID`);
    return undefined;
  }
  // ... generate URI
} catch (error) {
  console.error(`Failed to generate Obsidian URI:`, error);
  return undefined;
}
```

**No truncation handling**: Per spec clarification, if CalDAV server truncates DESCRIPTION, the URI may break (acceptable; assumes standard servers have adequate limits of 1000+ chars).

---

## Decision 6: TypeScript Type Extensions

**Decision**: Extend existing types minimally to support DESCRIPTION field in VTODO handling.

**Rationale**:
- **Type safety**: Maintain strict TypeScript compliance throughout the feature
- **Minimal changes**: DESCRIPTION is optional; most existing types work as-is
- **Backward compatibility**: New parameter is optional in all modified functions

**Type Additions**:

1. **CalDAV Client** (`caldav/client.ts`):
```typescript
// Modify createTask signature:
async createTask(vtodoData: string, description?: string): Promise<...>
```

2. **URI Builder** (new file `obsidian/uriBuilder.ts`):
```typescript
export function buildObsidianURI(
  vaultName: string,
  filePath: string,
  blockId: string
): string;

export function buildDescriptionWithURI(uri: string, existingDescription?: string): string;
```

3. **No changes needed** to:
- Task interface (already has blockId and filePath)
- SyncMapping interface (no URI storage needed)
- VTODO types (DESCRIPTION is implicit in VTODO string data)

---

## Decision 7: Testing Strategy

**Decision**: Manual testing in development vault with systematic test scenarios covering edge cases.

**Rationale**:
- **Existing pattern**: Project currently relies on manual testing (no automated test suite)
- **CalDAV integration**: Requires real CalDAV server for end-to-end validation
- **Client diversity**: Need to test across multiple CalDAV clients (Apple, Google, Thunderbird)
- **URI behavior**: Must verify actual link clicking behavior in each client

**Test Scenarios** (from spec.md):

1. **Basic functionality**:
   - Create task in Obsidian → verify URI appears in CalDAV DESCRIPTION
   - Click URI in CalDAV client → verify Obsidian opens to correct note+block
   - Update task in Obsidian → verify DESCRIPTION unchanged on CalDAV

2. **Edge cases**:
   - Vault name with spaces: `"My Work Vault"`
   - File path with spaces: `"Projects/Q1 Planning/tasks.md"`
   - File path with special chars: `"Tasks & Goals (2024).md"`
   - Unicode in vault/file names: `"📁 Archive/タスク.md"`
   - Multiple tasks in same note (different block IDs)
   - Task without block ID (should skip URI generation)

3. **Platform validation**:
   - Desktop: macOS, Windows, Linux
   - Mobile: iOS, Android
   - CalDAV clients: Apple Calendar, Google Calendar, Thunderbird, Outlook

4. **Property preservation**:
   - Verify DESCRIPTION persists across multiple syncs
   - Verify updates to SUMMARY, STATUS, DUE don't affect DESCRIPTION
   - Verify two-way sync doesn't corrupt URI

**No automated tests initially**: Focus on manual validation for v1. Automated tests can be added in future if test infrastructure is built.

---

## Decision 8: RFC 5545 Compliance for DESCRIPTION

**Decision**: Use RFC 5545 TEXT value escaping for DESCRIPTION content when constructing VTODO.

**Rationale**:
- **Standard compliance**: RFC 5545 (iCalendar) defines TEXT value escaping rules
- **Existing pattern**: Codebase already uses escaping for SUMMARY field in `vtodo.ts:escapeText()`
- **Interoperability**: Proper escaping ensures URIs work across all CalDAV implementations
- **No double-escaping**: DESCRIPTION value is escaped once before embedding in VTODO

**Escaping Rules** (from RFC 5545 §3.3.11):
- Backslash: `\` → `\\`
- Semicolon: `;` → `\;`
- Comma: `,` → `\,`
- Newline: `\n` → `\n` (literal in iCalendar, but represented as `\n` in string)

**Implementation**:
- Reuse existing `escapeText()` function from `vtodo.ts`
- Apply to full DESCRIPTION value (including URI and any existing content)
- Example: `\n\nObsidian Link: obsidian://open?...` (newline is literal in VTODO format)

**VTODO Structure** (example):
```
BEGIN:VTODO
UID:some-uuid
SUMMARY:Task description text
DESCRIPTION:\n\nObsidian Link: obsidian://open?vault=...&file=...&block=...
STATUS:NEEDS-ACTION
END:VTODO
```

**No additional encoding needed**: URI itself uses percent-encoding (`%20`, etc.), which is safe in TEXT values.

---

## Open Questions & Future Enhancements

### Resolved in Spec
- ✅ Format for appending URI (newline + label)
- ✅ Truncation handling (allow truncation)
- ✅ Missing block ID behavior (skip URI generation)
- ✅ Update behavior (never overwrite DESCRIPTION)
- ✅ Duplicate task handling (separate tasks with unique URIs)

### Out of Scope (per spec.md)
- Updating URIs when notes are moved/renamed (URIs are set once, user responsibility to manage)
- Syncing URIs back from CalDAV to Obsidian (unidirectional feature)
- Handling stale URIs from deleted notes (OS error when clicked, user responsibility)
- Visual indicators in Obsidian showing CalDAV sync status (UI enhancement, separate feature)
- Supporting custom URI formats (standardized format only)

### Future Considerations
- **Automated tests**: Build test infrastructure for CalDAV sync features
- **URI validation**: Optional pre-flight check to verify note exists before generating URI
- **Bulk URI regeneration**: Command to update existing CalDAV tasks with URIs (if users want to backfill)
- **Settings toggle**: Allow users to disable URI syncing if desired (currently always-on)
- **DESCRIPTION field UI**: Show synced URIs in Obsidian task view (read-only)

---

## Technology Stack Validation

All dependencies are already present in the codebase:

| Dependency | Purpose | Status |
|---|---|---|
| TypeScript 5.8.3 | Language | ✅ Present |
| Obsidian API | Vault access, getName() | ✅ Present |
| txml | XML parsing (VTODO) | ✅ Present |
| Built-in HTTP | CalDAV requests | ✅ Present |
| esbuild | Bundler | ✅ Present |

**No new dependencies required** ✓

---

## Summary

All technical unknowns have been resolved. The implementation path is clear:

1. **URI Format**: Standard Obsidian URI with vault, file, and block parameters
2. **CalDAV Field**: Use DESCRIPTION property with labeled format
3. **Encoding**: `encodeURIComponent()` for vault and file names
4. **Integration**: Inject URI generation in `createTaskOnCalDAV()`
5. **Preservation**: Leverage existing property preservation pattern (no changes needed)
6. **Error Handling**: Graceful degradation with logging
7. **Types**: Minimal TypeScript extensions (optional description parameter)
8. **Testing**: Manual validation across platforms and clients
9. **Standards**: RFC 5545 TEXT escaping for DESCRIPTION content

**Next Phase**: Proceed to Phase 1 (Design & Contracts) to define data models and API contracts.

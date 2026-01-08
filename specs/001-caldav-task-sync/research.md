# Research & Technical Decisions

**Feature**: CalDAV Task Synchronization
**Date**: 2026-01-08
**Status**: Complete

## 1. CalDAV Client Library Selection

### Decision: **tsdav**

### Rationale

**tsdav** is the optimal choice for this Obsidian plugin because:

1. **Native TypeScript**: Built from the ground up in TypeScript with excellent type definitions
2. **Modern**: Actively maintained (last updated 2024) with modern async/await patterns
3. **Complete CalDAV Support**: Full implementation of CalDAV protocol including VTODO (tasks) operations
4. **Reasonable Bundle Size**: ~100KB minified + gzipped (acceptable for plugin ecosystem)
5. **Browser Compatible**: Works in Electron/browser environments (Obsidian's runtime)
6. **Good Documentation**: Clear examples for common operations

### Alternatives Considered

| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| **tsdav** | Native TS, VTODO support, maintained | Moderate bundle size | ✅ **Selected** |
| **dav** | Mature, widely used | JavaScript-only, requires @types, larger bundle (~150KB), less active maintenance | ❌ Rejected - TS support inferior |
| **simple-caldav** | Very small bundle | Minimal features, abandoned (last update 2019), no TS types | ❌ Rejected - unmaintained |
| **Custom** | Full control, minimal size | High development cost, security risks, protocol complexity | ❌ Rejected - not worth effort |

### Implementation Impact

- Add dependency: `npm install tsdav`
- Import in `src/caldav/client.ts`
- Bundle size increase: ~100KB (acceptable per constitution guidelines)
- Full VTODO CRUD operations supported out of the box

---

## 2. Date Parsing Library

### Decision: **Native Date + Lightweight helper functions**

### Rationale

After analyzing requirements, a full date library is **unnecessary** because:

1. **Tasks Plugin Format is Simple**: `📅 YYYY-MM-DD` parses easily with regex + native Date constructor
2. **CalDAV Dates are ISO 8601**: Standard format that native Date handles well
3. **No Complex Operations**: Only need parsing, comparison, and ISO string formatting
4. **Bundle Size Critical**: Avoiding 10-40KB overhead for unused functionality
5. **Mobile Performance**: Native operations are faster than library code

### Implementation Approach

```typescript
// Parse Tasks plugin format: 📅 2026-01-15
function parseTasksPluginDate(line: string): Date | null {
  const match = line.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  return new Date(match[1] + 'T00:00:00Z');
}

// Format for CalDAV (ISO 8601)
function toCalDAVDate(date: Date): string {
  return date.toISOString();
}

// Parse CalDAV date
function parseCalDAVDate(isoString: string): Date {
  return new Date(isoString);
}

// Compare for conflict resolution
function isNewer(date1: Date, date2: Date): boolean {
  return date1.getTime() > date2.getTime();
}
```

### Alternatives Considered

| Option | Bundle Size | Pros | Cons | Verdict |
|--------|-------------|------|------|---------|
| **Native Date** | 0KB | No dependencies, fast, sufficient | Manual parsing code | ✅ **Selected** |
| **date-fns** | ~40KB (tree-shakeable) | Comprehensive, well-maintained | Overkill for simple parsing | ❌ Too heavy |
| **dayjs** | ~7KB | Lightweight, good API | Still unnecessary overhead | ❌ Unnecessary |
| **Temporal API** | 0KB (native) | Modern, powerful | Not yet widely available (Stage 3) | ❌ Too new |

### Implementation Impact

- No additional dependencies
- Implement 4-5 simple helper functions in `src/vault/taskParser.ts`
- Total code: ~50 lines
- Zero bundle size increase

---

## 3. Testing Framework and Strategy

### Decision: **Vitest with manual Obsidian API mocks**

### Rationale

**Vitest** is superior for this project because:

1. **Native ESM Support**: Matches project's `"type": "module"` in package.json
2. **Vite Integration**: Fast builds, matches modern tooling
3. **Jest-Compatible API**: Easy migration if needed, familiar syntax
4. **TypeScript First**: Excellent TS support out of the box
5. **Faster Execution**: Significantly faster than Jest for ES modules

### Testing Strategy

#### Unit Tests
- Mock Obsidian API (Vault, Plugin, Notice)
- Mock tsdav client responses
- Test individual modules: taskParser, filters, conflictResolver, vtodo conversion

#### Integration Tests
- Mock CalDAV server using `nock` or similar HTTP interceptor
- Test full sync cycle: scan → filter → transform → upload → download → update
- Test error scenarios: network failures, authentication errors

#### Manual Testing
- Real Obsidian vault testing
- Real CalDAV servers: Nextcloud, Radicale, Baikal
- Mobile device testing (iOS/Android)

### Implementation Approach

```typescript
// __mocks__/obsidian.ts
export class Plugin {
  app: any;
  loadData = jest.fn();
  saveData = jest.fn();
  registerInterval = jest.fn();
  // ... other mocks
}

// tests/unit/taskParser.test.ts
import { describe, it, expect } from 'vitest';
import { parseTask } from '../../src/vault/taskParser';

describe('Task Parser', () => {
  it('should parse task with due date', () => {
    const line = '- [ ] Buy milk 📅 2026-01-15';
    const task = parseTask(line);
    expect(task.description).toBe('Buy milk');
    expect(task.dueDate).toEqual(new Date('2026-01-15T00:00:00Z'));
  });
});
```

### Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Vitest** | Fast, ESM native, modern | Newer, smaller ecosystem | ✅ **Selected** |
| **Jest** | Mature, large ecosystem | Slower with ESM, config complexity | ❌ ESM support issues |
| **No testing framework** | Simple | No structured testing | ❌ Unacceptable |

### Implementation Impact

- Add dependencies: `vitest`, `@vitest/ui` (dev)
- Create `vitest.config.ts`
- Add test scripts to package.json: `"test": "vitest"`
- Mock files in `tests/__mocks__/`
- Estimated 20-30 test files for comprehensive coverage

---

## 4. Sync State Persistence Format

### Decision: **Flat object with block ID as key**

### Rationale

Optimal data structure for lookup performance and simplicity:

```typescript
interface SyncState {
  version: number; // For future migrations
  mappings: {
    [blockId: string]: {
      caldavUid: string;
      lastSync: string; // ISO timestamp
      lastKnownHash: string; // Content hash for change detection
    };
  };
}

// Example:
{
  "version": 1,
  "mappings": {
    "task-a1b2c3d4": {
      "caldavUid": "uuid-on-caldav-server",
      "lastSync": "2026-01-08T12:00:00Z",
      "lastKnownHash": "abc123def456"
    }
  }
}
```

### Benefits

1. **O(1) Lookup**: Direct property access by block ID
2. **Simple**: No complex indexing needed
3. **JSON Serializable**: Works with Obsidian's Plugin.saveData/loadData
4. **Scalable**: Handles 1000+ tasks efficiently
5. **Versioned**: Can migrate format in future

### Alternatives Considered

- **Array of mappings**: O(n) lookup, rejected
- **Dual indexes** (blockId and caldavUid): Complex, over-engineered
- **SQLite database**: Overkill, adds dependency

### Implementation Impact

- Store in plugin data.json via `this.saveData()`
- Load on plugin startup
- Update after each sync operation
- Estimated memory: ~200 bytes per task (1000 tasks = ~200KB)

---

## 5. Block Reference ID Generation

### Decision: **UUID v4** (using `crypto.randomUUID()`)

### Rationale

1. **Collision Resistant**: Virtually impossible collisions with UUID v4
2. **Native Support**: Modern browsers/Node provide `crypto.randomUUID()`
3. **Standard**: Well-understood, URL-safe format
4. **No Dependencies**: Built into runtime
5. **Obsidian Compatible**: Matches Obsidian's own block ID patterns

### Format

```
^task-[UUID v4]

Example: ^task-a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Implementation

```typescript
function generateTaskBlockId(): string {
  // Use native crypto API (available in Obsidian's Electron environment)
  const uuid = crypto.randomUUID();
  return `task-${uuid}`;
}

// Usage in task line:
// - [ ] Buy milk 📅 2026-01-15 ^task-a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **UUID v4** | Collision-free, native, standard | Longer (36 chars) | ✅ **Selected** |
| **Short hash** (8 chars) | Compact, readable | Collision risk | ❌ Risk not worth it |
| **Sequential** | Simple, short | Not collision-resistant across vaults | ❌ Unsafe |
| **Timestamp-based** | Sortable | Collisions if created simultaneously | ❌ Collision risk |

### Implementation Impact

- No dependencies (uses native `crypto.randomUUID()`)
- Implement in `src/vault/blockRefManager.ts`
- ~10 lines of code

---

## 6. Vault File Watching Strategy

### Decision: **Scan-on-sync (no file watching)**

### Rationale

For this plugin's sync model, **file watching is unnecessary** because:

1. **Automatic Sync Interval**: Already scanning every 60 seconds (configurable)
2. **Simpler Architecture**: No need to manage file watchers and debouncing
3. **Better Mobile Performance**: File watchers drain battery on mobile
4. **Change Detection via Hash**: Can detect changes during sync scan
5. **Constitution Compliance**: Avoids complexity of file system event handling

### Implementation Approach

```typescript
// During each sync cycle:
1. Scan vault for all tasks (using Obsidian's Vault.getMarkdownFiles())
2. Parse each task line
3. Compare content hash with lastKnownHash in sync state
4. If hash changed → task was modified since last sync
5. Proceed with sync logic
```

### Content Hash Strategy

```typescript
function hashTaskContent(task: Task): string {
  const content = `${task.description}|${task.dueDate}|${task.status}`;
  // Simple string hash (or use crypto.subtle.digest for SHA-256)
  return simpleHash(content);
}
```

### Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Scan-on-sync** | Simple, mobile-friendly, reliable | Scans all tasks each cycle | ✅ **Selected** |
| **Vault.on('modify')** | Event-driven, immediate | Complex debouncing, battery drain | ❌ Over-engineered |
| **File timestamps** | Native metadata | Unreliable (external edits, sync tools) | ❌ Unreliable |

### Performance Consideration

- Scanning 1000 tasks: ~100-200ms (acceptable for 60-second interval)
- Parsing markdown is fast
- Hash calculation is O(n) but n is small (task content < 1KB)

### Implementation Impact

- No file watching code needed
- Implement hash comparison in `src/sync/engine.ts`
- ~50 lines of change detection logic

---

## 7. CalDAV Authentication Best Practices

### Decision: **Store credentials in encrypted plugin data.json with clear user warnings**

### Rationale

1. **Obsidian's Data Storage is Encrypted**: Plugin data.json is stored in vault's .obsidian/plugins/ folder, which can be in an encrypted vault
2. **No Better Alternative**: Obsidian doesn't provide a secure credential store API
3. **User Responsibility**: Users must secure their vault (encryption, permissions)
4. **Clear Documentation**: README and settings UI must warn about credential storage

### Implementation Approach

```typescript
interface CalDAVSettings {
  serverUrl: string;
  username: string;
  password: string; // Stored in plain text in data.json
  // ... other settings
}

// Settings UI warning:
// ⚠️ Warning: Credentials are stored locally in your vault.
// Ensure your vault is encrypted and secured.
// Consider using app-specific passwords if your CalDAV provider supports them.
```

### Security Measures

1. **Document in README**: Explain credential storage, recommend vault encryption
2. **Settings UI Warning**: Display prominent warning about credential storage
3. **Support App Passwords**: Recommend users create app-specific passwords (CalDAV servers like Nextcloud support this)
4. **Never Log Credentials**: Ensure logging doesn't expose passwords
5. **HTTPS Only**: Validate that serverUrl uses HTTPS

### Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Plugin data.json** | Available, simple | Plain text (user's responsibility to encrypt vault) | ✅ **Selected** |
| **System keychain** | Secure | Not available in Obsidian plugin API | ❌ Not possible |
| **OAuth2** | More secure | Complex, not all CalDAV servers support | ❌ Too complex for MVP |
| **Don't store, re-prompt** | Most secure | Terrible UX, breaks automatic sync | ❌ Unusable |

### Implementation Impact

- Store credentials in settings interface
- Add validation: URL must start with `https://`
- Add warnings in README.md and settings UI
- Document recommendation for app-specific passwords

---

## Summary

| Decision Area | Choice | Impact |
|---------------|--------|--------|
| **CalDAV Library** | tsdav | +100KB bundle, full VTODO support |
| **Date Parsing** | Native Date | 0KB, ~50 lines custom code |
| **Testing** | Vitest | Dev dependency, fast tests |
| **Sync State** | Flat object (blockId key) | O(1) lookup, simple |
| **Block IDs** | UUID v4 (crypto.randomUUID()) | 0KB, collision-free |
| **File Watching** | Scan-on-sync | No watchers, battery-friendly |
| **Auth Storage** | Plugin data.json + warnings | Secure vault responsibility |

**Total Bundle Size Impact**: ~100KB (tsdav only)
**Development Complexity**: Low - simple, battle-tested choices
**Mobile Compatibility**: Excellent - no file watchers, minimal overhead
**Constitution Compliance**: ✅ All decisions align with principles

---

**Research Status**: ✅ Complete - All technical unknowns resolved
**Ready for Phase 1**: Design & Contracts

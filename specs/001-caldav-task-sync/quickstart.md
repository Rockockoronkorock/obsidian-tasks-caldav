# Developer Quickstart Guide

**Feature**: CalDAV Task Synchronization
**Date**: 2026-01-08
**Status**: Phase 1 Design

## Overview

This guide will help you set up a local development environment for the CalDAV Task Synchronization plugin. You'll be able to build, test, and run the plugin in a local Obsidian vault with a test CalDAV server.

**Estimated Setup Time**: 15-20 minutes

---

## Prerequisites

### Required Software

1. **Node.js** (v18 or later)
   - Check: `node --version`
   - Install: https://nodejs.org/

2. **npm** (comes with Node.js)
   - Check: `npm --version`

3. **Git**
   - Check: `git --version`
   - Install: https://git-scm.com/

4. **Obsidian** (latest version)
   - Download: https://obsidian.md/

5. **Docker** (optional, for local CalDAV server)
   - Check: `docker --version`
   - Install: https://www.docker.com/get-started

### Recommended Tools

- **Visual Studio Code** with TypeScript extension
- **Obsidian Developer Tools**: Enable Developer Mode in Obsidian Settings

---

## Initial Setup

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/obsidian-tasks-caldev.git
cd obsidian-tasks-caldev

# Switch to feature branch
git checkout 001-caldav-task-sync
```

### 2. Install Dependencies

```bash
# Install npm dependencies
npm install
```

**Expected Dependencies** (based on [research.md](./research.md)):
- `obsidian` (latest) - Obsidian API types
- `tsdav` - CalDAV client library
- `typescript` (5.8.3+) - TypeScript compiler
- `esbuild` - Bundler
- `vitest` - Testing framework
- `@vitest/ui` - Test UI (dev dependency)

### 3. Verify Installation

```bash
# Check that TypeScript compiles
npm run build

# Expected output:
# > obsidian-tasks-caldev@0.0.1 build
# > esbuild src/main.ts --bundle --outfile=main.js --external:obsidian --format=cjs
#
# Build complete: main.js
```

---

## Development Workflow

### Build Commands

```bash
# One-time build
npm run build

# Watch mode (rebuild on file changes)
npm run dev

# Production build (minified)
npm run build:production
```

### Project Structure

```
obsidian-tasks-caldev/
├── src/                      # Source code
│   ├── main.ts               # Plugin entry point
│   ├── types.ts              # TypeScript interfaces
│   ├── caldav/               # CalDAV client module
│   ├── sync/                 # Sync engine module
│   ├── vault/                # Vault scanning module
│   └── ui/                   # Settings UI module
├── tests/                    # Test files
│   ├── unit/
│   ├── integration/
│   └── __mocks__/
├── specs/                    # Design documentation
│   └── 001-caldav-task-sync/
├── manifest.json             # Plugin metadata
├── package.json              # npm configuration
├── tsconfig.json             # TypeScript configuration
├── vitest.config.ts          # Test configuration
└── README.md                 # User documentation
```

---

## Local Testing Setup

### Option 1: Test with Local Radicale Server (Recommended)

**Radicale** is a lightweight CalDAV server perfect for testing.

#### Start Radicale with Docker

```bash
# Start Radicale server
docker run -d \
  --name radicale-test \
  -p 5232:5232 \
  tomsquest/docker-radicale

# Verify it's running
curl http://localhost:5232/.web/
# Should return HTML page
```

#### Configure Plugin for Local Server

In Obsidian plugin settings:
- **Server URL**: `http://localhost:5232`
- **Username**: `test` (any value works)
- **Password**: `test` (any value works)
- **Calendar Path**: `/test/tasks/` (will be auto-created)

**Note**: Radicale creates calendars automatically when you first sync.

#### Stop Radicale

```bash
# Stop and remove container
docker stop radicale-test
docker rm radicale-test
```

---

### Option 2: Test with Real CalDAV Server

If you have access to a CalDAV server (Nextcloud, Baikal, etc.):

1. Create a dedicated test calendar named "Obsidian Tasks Test"
2. Create an app-specific password (if supported)
3. Configure plugin settings with your server details
4. **WARNING**: Use a test vault with sample tasks, not your production vault

**Recommended Test Servers**:
- **Nextcloud**: https://nextcloud.com/ (full-featured)
- **Baikal**: https://sabre.io/baikal/ (lightweight, self-hosted)

---

## Testing the Plugin

### Install Plugin in Test Vault

#### Create Test Vault

1. Open Obsidian
2. Create new vault: "Obsidian Tasks CalDAV Test"
3. Add sample tasks:

```markdown
# Sample Tasks

- [ ] Buy groceries 📅 2026-01-15
- [ ] Call dentist 📅 2026-01-10
- [x] Finish report
- [ ] Read book #personal
```

#### Symlink Plugin to Vault

```bash
# Navigate to test vault's plugin directory
cd "/path/to/ObsidianTasksCalDAVTest/.obsidian/plugins"

# Create plugin directory
mkdir obsidian-tasks-caldev

# Symlink build output
ln -s /path/to/obsidian-tasks-caldev/main.js obsidian-tasks-caldev/main.js
ln -s /path/to/obsidian-tasks-caldev/manifest.json obsidian-tasks-caldev/manifest.json
ln -s /path/to/obsidian-tasks-caldev/styles.css obsidian-tasks-caldev/styles.css
```

**Windows (use mklink instead)**:
```cmd
mklink "C:\path\to\vault\.obsidian\plugins\obsidian-tasks-caldev\main.js" "C:\path\to\obsidian-tasks-caldev\main.js"
mklink "C:\path\to\vault\.obsidian\plugins\obsidian-tasks-caldev\manifest.json" "C:\path\to\obsidian-tasks-caldev\manifest.json"
```

#### Enable Plugin

1. In Obsidian, open Settings → Community Plugins
2. Disable Safe Mode (if prompted)
3. Enable "CalDAV Task Sync" plugin
4. Configure settings (see Option 1 or 2 above)

#### Verify Plugin Loaded

1. Open Developer Console: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
2. Look for plugin initialization logs
3. Run command: `Ctrl+P` → "CalDAV: Sync tasks now"

---

## Running Tests

### Unit Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run specific test file
npm test -- tests/unit/taskParser.test.ts
```

### Test Coverage

```bash
# Generate coverage report
npm run test:coverage

# View coverage report
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

### Integration Tests

```bash
# Start local Radicale server (if not already running)
docker run -d --name radicale-test -p 5232:5232 tomsquest/docker-radicale

# Run integration tests
npm run test:integration

# Stop Radicale
docker stop radicale-test && docker rm radicale-test
```

---

## Development Tips

### Hot Reload

When using `npm run dev`, the plugin will rebuild on file changes. To reload in Obsidian:

1. **Option A**: Use "Reload app without saving" command
   - `Ctrl+P` → "Reload app without saving"

2. **Option B**: Toggle plugin off/on
   - Settings → Community Plugins → Toggle "CalDAV Task Sync"

3. **Option C**: Use Hot Reload Plugin
   - Install "Hot Reload" community plugin
   - Automatically reloads on file changes

### Debugging

#### Enable Debug Logging

In `src/main.ts`:
```typescript
const DEBUG = true; // Set to true for verbose logging

if (DEBUG) {
  console.log('[CalDAV Sync]', ...args);
}
```

#### Use Obsidian Developer Tools

1. Open Developer Console: `Ctrl+Shift+I`
2. Go to "Console" tab
3. Filter logs: Type "CalDAV" in filter box

#### Inspect Plugin Data

```javascript
// Run in Developer Console
app.plugins.plugins['obsidian-tasks-caldev'].settings
```

### TypeScript Type Checking

```bash
# Type check without building
npm run type-check

# Watch mode for type checking
npm run type-check:watch
```

---

## Common Issues

### Issue: "Module not found: obsidian"

**Solution**: Install Obsidian types
```bash
npm install --save-dev obsidian
```

### Issue: Plugin doesn't appear in Obsidian

**Solution**: Check manifest.json is valid
```bash
cat manifest.json | jq .  # Validate JSON syntax
```

Ensure manifest has required fields:
```json
{
  "id": "obsidian-tasks-caldev",
  "name": "CalDAV Task Sync",
  "version": "0.0.1",
  "minAppVersion": "0.15.0",
  "description": "Sync Obsidian tasks with CalDAV servers"
}
```

### Issue: Build fails with "tsdav not found"

**Solution**: Ensure tsdav is installed
```bash
npm install tsdav
```

### Issue: CalDAV connection fails

**Solutions**:
1. Verify server URL is correct (include protocol: `http://` or `https://`)
2. Check username/password are correct
3. Test server manually:
   ```bash
   curl -u username:password https://caldav.example.com/
   ```
4. Check firewall/network settings
5. Look for CORS issues (open Developer Console)

### Issue: Tasks not syncing

**Debug Steps**:
1. Open Developer Console (`Ctrl+Shift+I`)
2. Look for error messages
3. Check sync mappings:
   ```javascript
   app.plugins.plugins['obsidian-tasks-caldev'].syncState.mappings
   ```
4. Verify task has block reference (e.g., `^task-uuid`)
5. Check if task passes filters (folder exclusions, tag exclusions)

---

## Next Steps

### After Initial Setup

1. **Read Design Docs**: Review [data-model.md](./data-model.md) and [contracts/caldav-api.md](./contracts/caldav-api.md)
2. **Run Tests**: Ensure all existing tests pass with `npm test`
3. **Follow Tasks**: Implementation tasks are in [tasks.md](./tasks.md) (created by `/speckit.tasks`)
4. **Start Coding**: Begin with first task in tasks.md

### Before Committing Code

- [ ] Run type checker: `npm run type-check`
- [ ] Run tests: `npm test`
- [ ] Run linter: `npm run lint`
- [ ] Build successfully: `npm run build`
- [ ] Test in Obsidian: Verify plugin loads and basic functionality works

### Code Style

- Use TypeScript strict mode (enabled in tsconfig.json)
- Follow Obsidian plugin patterns (see `main.ts` for examples)
- Add JSDoc comments to public interfaces
- Keep modules small (< 300 lines per file)
- Use async/await, not callbacks

---

## Resources

### Obsidian Plugin Development

- **Official Docs**: https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- **Plugin Guidelines**: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- **API Reference**: https://github.com/obsidianmd/obsidian-api
- **Sample Plugin**: https://github.com/obsidianmd/obsidian-sample-plugin

### CalDAV Resources

- **RFC 4791** (CalDAV): https://tools.ietf.org/html/rfc4791
- **RFC 5545** (iCalendar): https://tools.ietf.org/html/rfc5545
- **tsdav Documentation**: https://github.com/natelindev/tsdav

### Testing Resources

- **Vitest Docs**: https://vitest.dev/
- **Mocking Guide**: https://vitest.dev/guide/mocking.html

---

## Getting Help

- **GitHub Issues**: Report bugs or ask questions
- **Obsidian Forum**: https://forum.obsidian.md/
- **Discord**: Obsidian Community Server

---

**Quickstart Version**: 1.0
**Last Updated**: 2026-01-08
**Compatible with**: [plan.md](./plan.md), [spec.md](./spec.md)

# CalDAV Task Sync for Obsidian

Bidirectionally sync your Obsidian tasks with CalDAV servers, enabling seamless integration with popular calendar applications like Nextcloud Tasks, Radicale, and Baikal.

## Features

- **Bidirectional Sync**: Keep tasks in sync between Obsidian and your CalDAV server
- **Automatic Background Sync**: Configure intervals for automatic synchronization
- **Manual Sync**: Trigger sync on-demand via command palette
- **Server Compatibility**: Works with Nextcloud, Radicale, Baikal, and other CalDAV-compliant servers
- **Task Filtering**: Configure which tasks to sync with customizable filters
- **Link Preservation**: Maintains Obsidian internal links during sync
- **Debug Logging**: Optional debug mode for troubleshooting

## Setup

### 1. Install the Plugin

- Download and enable the plugin from Obsidian's Community Plugins
- Or manually install by copying `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/obsidian-tasks-caldev/` folder

### 2. Configure CalDAV Server

1. Open Settings → CalDAV Task Sync
2. Enter your CalDAV server details:
   - **Server URL**: Your CalDAV server endpoint (e.g., `https://cloud.example.com/remote.php/dav`)
   - **Username**: Your CalDAV account username
   - **Password**: Your CalDAV account password
   - **Calendar**: The calendar name to sync tasks with (default: `tasks`)

### 3. Configure Sync Settings

- **Enable Auto Sync**: Toggle automatic background synchronization
- **Sync Interval**: Set how often to sync (in minutes)
- **Task Filters**: Configure which tasks to include/exclude from sync
- **Debug Logging**: Enable for detailed sync logs (disable in production)

## Usage

### Manual Sync

Trigger a sync manually using the command palette:
1. Open Command Palette (Ctrl/Cmd + P)
2. Search for "Sync tasks now"
3. Press Enter

### Automatic Sync

When enabled, the plugin will automatically sync tasks at the configured interval. A status indicator shows sync progress.

### Task Format

Tasks in Obsidian should use the standard format:
```markdown
- [ ] Task description
- [x] Completed task
```

Tasks are synced bidirectionally:
- New tasks in Obsidian → Created on CalDAV server
- Tasks updated in Obsidian → Updated on CalDAV server
- Tasks from CalDAV server → Created/updated in Obsidian

## Supported CalDAV Servers

Tested and compatible with:
- **Nextcloud** (with Tasks app)
- **Radicale**
- **Baikal**
- Any RFC 4791 compliant CalDAV server

## Troubleshooting

### Connection Issues

- Verify your server URL, username, and password
- Check that your CalDAV server is accessible from your network
- Enable debug logging to see detailed connection attempts

### Tasks Not Syncing

- Ensure the calendar name matches exactly (case-sensitive)
- Check that tasks are in the correct markdown format
- Review debug logs for sync errors
- Verify task filters aren't excluding desired tasks

### Debug Logging

Enable debug logging in settings to troubleshoot issues:
1. Settings → CalDAV Task Sync
2. Enable "Debug Logging"
3. Open Developer Console (Ctrl/Cmd + Shift + I)
4. Perform sync and review console output

## Privacy & Security

- Credentials are stored securely in Obsidian's plugin data storage
- All communication with CalDAV servers uses HTTPS
- No data is sent to third parties
- Task data remains synchronized only between your Obsidian vault and your configured CalDAV server

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Development build (watch mode)
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

### Testing

```bash
# Run tests
npm test

# Run tests with UI
npm test:ui

# Run tests with coverage
npm test:coverage
```

## Support

For bug reports and feature requests, please visit the [GitHub repository](https://github.com/yourusername/obsidian-tasks-caldev).

## License

MIT License - see [LICENSE](LICENSE) file for details.

<!--
Sync Impact Report:
- Version change: N/A → 1.0.0
- Initial constitution creation based on AGENTS.md
- Principles extracted from existing project guidelines
- Added sections: Core Principles (5), Development Standards, Governance
- Templates requiring updates:
  ✅ .specify/templates/plan-template.md (reviewed - Constitution Check section already present)
  ✅ .specify/templates/spec-template.md (reviewed - aligned with principles)
  ✅ .specify/templates/tasks-template.md (reviewed - task organization compatible)
- Follow-up TODOs: None
-->

# Obsidian Plugin Development Constitution

## Core Principles

### I. Modularity & Code Organization

**Rule**: Keep `main.ts` minimal and focused solely on plugin lifecycle (onload, onunload,
command registration). All feature logic MUST be delegated to separate, focused modules. Any
file exceeding 200-300 lines MUST be split into smaller modules with clear, single
responsibilities.

**Rationale**: Maintainability scales inversely with file size and coupling. A minimal entry
point ensures predictable plugin lifecycle, easier testing, and clearer module boundaries.
This principle prevents the common anti-pattern of monolithic plugin files that become
unmaintainable.

**Requirements**:
- Source code MUST live in `src/` directory with clear module structure (commands/, ui/,
  utils/, types.ts)
- Each module MUST have a single, well-defined responsibility
- Build artifacts (node_modules/, main.js) MUST NEVER be committed to version control

### II. Security & Privacy First

**Rule**: Default to local/offline operation. Network requests are permitted ONLY when
essential to the feature and MUST require explicit user opt-in with clear documentation.
Never execute remote code, fetch-and-eval scripts, or collect telemetry without explicit
consent. Minimize vault access scope.

**Rationale**: User trust is non-negotiable. Obsidian users expect their data to remain
private and local. Any deviation from this expectation requires transparent disclosure and
informed consent.

**Requirements**:
- NO hidden telemetry or analytics without explicit opt-in
- NO remote code execution or auto-updates outside normal release channels
- Read/write ONLY what's necessary inside the vault; never access files outside vault
- All external services, data transmission, and risks MUST be clearly documented in README.md
  and settings UI
- Register and clean up all DOM, app, and interval listeners using `this.register*` helpers
  to ensure safe unload

### III. Versioning & API Stability

**Rule**: Use Semantic Versioning (MAJOR.MINOR.PATCH) strictly. Plugin `id` and command IDs
are immutable after first release. The `minAppVersion` field MUST be kept accurate when using
newer Obsidian APIs. Release artifacts (manifest.json, main.js, styles.css) MUST be attached
to GitHub releases with tags matching manifest.json version exactly (no "v" prefix).

**Rationale**: Breaking changes without version signals destroy user trust and plugin
ecosystem stability. Stable identifiers are API contracts that downstream systems depend on.

**Requirements**:
- NEVER change plugin `id` after first release
- NEVER rename command IDs once released
- GitHub release tag MUST exactly match `manifest.json` version field (e.g., "1.2.3" not
  "v1.2.3")
- Update `versions.json` to map plugin version → minimum Obsidian version
- Follow canonical manifest requirements:
  https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml

### IV. Performance & Resource Efficiency

**Rule**: Keep plugin startup lightweight. Defer heavy initialization until needed. Avoid
long-running tasks during `onload`. Batch disk operations and debounce/throttle expensive
operations in response to file system events.

**Rationale**: Plugin performance directly impacts user experience. Obsidian users run
multiple plugins; each must be a good citizen regarding CPU, memory, and I/O resources. Heavy
startup degrades vault opening time. Mobile platforms have strict resource constraints.

**Requirements**:
- Use lazy initialization for non-critical features
- Batch vault scans and disk access operations
- Debounce/throttle file system event handlers
- Keep plugin bundle size small; avoid large dependencies; prefer browser-compatible packages
- Test on mobile (iOS/Android) unless `isDesktopOnly: true`
- Avoid large in-memory structures on mobile platforms

### V. Obsidian Policy Compliance (NON-NEGOTIABLE)

**Rule**: ALL code MUST comply with Obsidian's Developer Policies and Plugin Guidelines. This
includes but is not limited to: no deceptive patterns, no ads, no spammy notifications, proper
manifest fields, and safe resource cleanup.

**Rationale**: Plugin guidelines exist to protect the ecosystem and user experience.
Non-compliance risks plugin rejection or removal from the community catalog.

**Requirements**:
- Review and follow: https://docs.obsidian.md/Developer+policies
- Review and follow: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Manifest MUST include: id, name, version, minAppVersion, description, isDesktopOnly
- UX copy MUST use sentence case, clear imperatives, and arrow notation for navigation
  (Settings → Community plugins)
- TypeScript with `"strict": true` is strongly recommended
- Prefer `async/await` over promise chains; handle errors gracefully

## Development Standards

### Build & Tooling

This project uses **npm** as the package manager and **esbuild** as the bundler. These are
REQUIRED dependencies for this sample project. Alternative tools (yarn, pnpm, rollup, webpack)
are acceptable for other projects IF the build configuration is updated accordingly.

**Build commands**:
- Install: `npm install`
- Development (watch): `npm run dev`
- Production build: `npm run build`
- Linting: `npm run lint` (uses eslint-plugin-obsidianmd)

**Output requirements**:
- All external dependencies MUST be bundled into `main.js`
- Release artifacts MUST end up at plugin root: `main.js`, `manifest.json`, `styles.css`
  (optional)

### Testing & Quality

- **Manual testing**: Copy artifacts to `<Vault>/.obsidian/plugins/<plugin-id>/` and reload
  Obsidian
- **Linting**: Use `npm run lint` to verify code quality and Obsidian-specific guidelines
- **Mobile testing**: Test on iOS and Android unless `isDesktopOnly: true`

### Code Conventions

- TypeScript with strict mode enabled
- Use `this.register*` helpers for all event listeners, DOM events, and intervals
- Write idempotent code paths so reload/unload doesn't leak resources
- Provide defaults and validation for all settings
- Use stable command IDs (never rename after release)

## Governance

### Authority

This constitution supersedes conflicting guidance in other documentation. When principles
conflict with convenience, principles win. All code reviews, pull requests, and architectural
decisions MUST verify compliance with these principles.

### Amendment Process

1. Proposed changes MUST be documented with rationale and impact analysis
2. Constitution version MUST be bumped according to semantic versioning:
   - **MAJOR**: Backward incompatible governance changes or principle removals
   - **MINOR**: New principles added or existing principles materially expanded
   - **PATCH**: Clarifications, wording fixes, non-semantic refinements
3. Template synchronization MUST occur with every amendment
4. All affected team members MUST review and approve amendments

### Compliance

- All PRs MUST include verification that changes comply with Core Principles
- Complexity or deviations from principles MUST be explicitly justified in code reviews
- For runtime development guidance, refer to `AGENTS.md` for detailed technical procedures

### Documentation

- Architecture decisions that deviate from principles MUST be documented in plan.md with
  justification
- Breaking changes MUST be prominently documented in release notes
- Security-sensitive features MUST be documented in README.md before implementation

**Version**: 1.0.0 | **Ratified**: 2026-01-08 | **Last Amended**: 2026-01-08

# GoreeCloud Notebook

**Capture. Create. Connect. Organize. Remember.**

GoreeCloud Notebook is my privacy-first knowledge workspace combining everyday notes with hierarchical knowledge management, linked ideas, tasks, and long-term data ownership.

> **Status: v0.1.0 development preview, not production-ready.** This repository includes a local-first progressive web application. Cloud sync, E2EE, team collaboration, OCR, native mobile apps, and GoreeCloud AI are not yet implemented. A Chromium browser smoke covering creation, editing, autosave, stale-tab conflict rejection, tasks, search, favorites, archive/trash restore, backup import/export and cached-shell offline reopening passes in CI. Broader platform, backup, security and visual acceptance remain pending.

## Run locally

Requirements: a modern browser; Node.js 22+ to run checks; Python 3 to serve the app.

1. Clone this repository.
2. Run **npm run check**, **npm test**, and **npm run test:browser** (Chromium required for the browser smoke).
3. Run **npm start**, then browse to http://localhost:4173.
4. Open Settings and export a JSON backup regularly.

Static HTTP hosting also works. Service workers require localhost or HTTPS; opening the HTML file directly from disk is not supported.

## Foundation capabilities

- IndexedDB-backed local note editing with debounced autosave, transactional revision checks and visible stale-tab conflict warnings.
- Parent-child hierarchy, nested note tree, move with cycle prevention.
- Title/body/tag search; explicit wiki links and backlinks.
- Task notes, due dates, completion; favorites; archive; trash and restore.
- Note duplication, dashboard statistics, safe basic Markdown preview.
- Portable JSON backups with schema validation, duplicate-ID and cycle checks.
- Light/dark appearance, responsive layout, shortcuts and PWA offline shell (reopening tested with Chromium networking disabled; installed-device acceptance pending).

**Important:** When another browser tab writes a newer version, stale writes are refused. Export unsaved changes from the blocked tab before reloading; there is no automatic merge. Browser data can be erased. The app does not encrypt local notes or exported JSON. It does not upload data, contact an AI provider, or implement remote synchronization. Keep separate protected backups. This preview does not yet offer full Markdown editing or attachments.

The application uses GoreeCloud UI semantic roles and layout principles. Fallback colors remain provisional; final visual and accessibility compliance has not been established.

## Documentation

- [Product specification](docs/PRODUCT-SPECIFICATION.md)
- [Implemented features](docs/IMPLEMENTED-FEATURES.md)
- [Planned features](docs/PLANNED-FEATURES.md)
- [Competitive objectives](docs/COMPETITIVE-OBJECTIVES.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Roadmap](docs/ROADMAP.md)

GoreeShield governs privacy; Wardveil governs cybersecurity; GoreeCloud Mesh governs interoperability; GoreeCloud UI governs design. GoreeCloud Identity is a separate future identity integration boundary. None of their remote integrations is claimed operational in this preview.

## License

MIT, see [LICENSE](LICENSE). Original source authored for this repository. Third-party dependencies, media, fonts, assets, import formats and future plugins require separate provenance and licensing review.

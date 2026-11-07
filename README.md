# GoreeCloud Notebook

**Capture. Create. Connect. Organize. Remember.**

GoreeCloud Notebook is my privacy-first knowledge workspace combining everyday notes with hierarchical knowledge management, linked ideas, tasks, and long-term data ownership.

> **Status: v0.1.0 development preview, not production-ready.** This repository includes a local-first progressive web application. Cloud sync, E2EE, team collaboration, OCR, native mobile apps, and GoreeCloud AI are not yet implemented. A Chromium browser smoke covering creation, editing, autosave, stale-tab conflict rejection, tasks, search, favorites, archive/trash restore, backup import/export and cached-shell offline reopening passes in CI. Broader platform, backup, security and visual acceptance remain pending.

## Run locally

Requirements: a modern browser; Node.js 22+ to run checks; Python 3 to serve the app.

1. Clone this repository.
2. Run **npm run check**, **npm test**, and **npm run test:browser** (Chromium required for the browser smoke).
3. Run **npm start**, then browse to http://localhost:4173.
4. Open Settings and export a JSON or gzip-compressed JSON backup regularly. See [Backups and Recovery](docs/BACKUPS.md).

Static HTTP hosting also works. `npm start` binds to `127.0.0.1` only, so it does not expose your development server to the local network. Service workers require localhost or HTTPS; opening the HTML file directly from disk is not supported.

## Static release candidate

Run `npm run build:release` to stage **`dist/`** with exactly ten runtime assets plus MIT `LICENSE`, upstream Apache-2.0 license and `THIRD_PARTY_NOTICES.md`. The script refuses to overwrite an existing `dist/` directory, and CI checks every bundled file against source while ensuring that `test/`, `scripts/` and `docs/` are absent. `dist/` is a **reviewable release candidate only**; nothing is uploaded, published or deployed. For future static hosting, serve only the reviewed `dist/` directory after explicit release authorization. See [testing and release isolation](docs/TESTING.md).

## Foundation capabilities

- IndexedDB-backed local note editing with debounced autosave, transactional revision checks, proactive same-origin stale-tab warnings (revision numbers only, checked against IndexedDB), with a tested refocus fallback when BroadcastChannel is unavailable, and a best-effort browser leave confirmation while edits are unsaved.
- Parent-child hierarchy, nested note tree, move with cycle prevention.
- Title/body/tag search; legacy [[Note title]] links plus rename-safe [[id:note-id]] links and backlinks. **Settings → Audit note links** finds missing, duplicate-title and fragile references without modifying notes. Use the editor's Copy permanent link action.
- Task notes, due dates, completion; favorites; archive; trash and restore.
- Note duplication, dashboard statistics, safe basic Markdown preview.
- Portable JSON backups and standard `.json.gz` compressed backups, with bounded decompression, schema checks, a read-only replacement-impact preview and one-step local import undo. The gzip format restores workspaces with more than 22 MB of source JSON, up to a 64 MB uncompressed limit.
- Optional browser persistent-storage request and approximate origin-storage quota display (neither is a backup or a guarantee against user deletion). On quota-rejected saves, Notebook retains the unsaved draft for export and explains the error; tested under a simulated quota failure, not real device exhaustion.
- Light/dark appearance and OS-preferred high-contrast colors driven by exact-copy, Apache-2.0 GoreeCloud UI Foundations 1.0.1 semantic tokens, responsive layout, shortcuts and network-refreshing PWA offline shell (reopening and unrelated-cache isolation tested in Chromium; installed-device acceptance pending).

**Important:** Plain JSON imports remain limited to 22 MB. Standard gzip JSON imports accept up to 66 MB compressed with a 64 MB decompressed cap. Larger exports are explicitly labeled un-restorable by this preview; fully streaming/chunked recovery is still planned. The local import recovery checkpoint is plaintext, consumes browser storage and is overwritten by the next full-workspace replacement. It cannot survive clearing the browser profile or device loss. Browser-persistent storage requests may be denied and do not protect against deliberate clearing or device loss. Export protected backups separately. When another browser tab writes a newer version, stale writes are refused. Export unsaved changes from the blocked tab before reloading; there is no automatic merge. Browser data can be erased. The app does not encrypt local notes or exported JSON. It does not upload data, contact an AI provider, or implement remote synchronization. Keep separate protected backups. This preview does not yet offer full Markdown editing or attachments.

The application uses the verified GoreeCloud UI Foundations 1.0.1 semantic tokens and product-specific components. Complete visual, cross-device and accessibility acceptance has not been established.

## Documentation

- [Product specification](docs/PRODUCT-SPECIFICATION.md)
- [Implemented features](docs/IMPLEMENTED-FEATURES.md)
- [Planned features](docs/PLANNED-FEATURES.md)
- [Competitive objectives](docs/COMPETITIVE-OBJECTIVES.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Link-integrity audit](docs/LINK-INTEGRITY.md) — local report of broken, ambiguous and legacy references.
- [Security](docs/SECURITY.md)
- [Roadmap](docs/ROADMAP.md)
- [Rendered UI review](docs/VISUAL-REVIEW.md)
- [Official Notebook UI mockup](docs/OFFICIAL-MOCKUP.md) — founder-approved visual reference, current alignment and unimplemented controls.
- [GC UI Foundations adoption and provenance](docs/GC-UI-ADOPTION.md) — pinned tokens, licensing and incomplete design acceptance.
- [Browser testing and data-safety evidence](docs/TESTING.md) — synthetic fixtures, cross-tab checks and quota limitations.
- [Backup and recovery guide](docs/BACKUPS.md) — JSON/gzip limits, import impact preview and local undo.
- [Third-party notices](THIRD_PARTY_NOTICES.md) — pinned GC UI Apache-2.0 attribution.

GoreeShield governs privacy; Wardveil governs cybersecurity; GoreeCloud Mesh governs interoperability; GoreeCloud UI governs design. GoreeCloud Identity is a separate future identity integration boundary. None of their remote integrations is claimed operational in this preview.

## License

MIT, see [LICENSE](LICENSE). Original source authored for this repository. Third-party dependencies, media, fonts, assets, import formats and future plugins require separate provenance and licensing review.

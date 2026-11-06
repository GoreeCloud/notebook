# GoreeCloud Notebook — Implemented Features (Development Preview)

**Status:** Implemented in source in feature branch, with passing JavaScript syntax, twelve model tests and expanded Chromium UI/storage/backup/offline-shell smoke tests (passing GitHub Actions run 42294300602). Full browser, platform, security and visual acceptance are not established as of November 6, 2026. **Not a stable release.**

| Capability | Owning source | Verification |
| --- | --- | --- |
| Note creation, title/body editing and debounced local saves | src/app.js, src/storage.js | Chromium smoke: create, edit and persist passed |
| IndexedDB persistence with revision checks, quota-error reporting and unsaved-exit protection | src/storage.js, src/app.js | Chromium confirms stale-tab rejection, atomic clone and simulated quota failure rollback, retained unsaved export, and conditional leave warning (run 42294300602) |
| Nested hierarchy, relocation and cycle prevention | src/model.js, src/app.js | Model cycle checks and Chromium nested-note create/move/parent-option regression passed |
| Favorites, archive, soft trash, restore and duplication | src/app.js, src/model.js | Chromium smoke passed for favorite, duplication, archive/restore, and trash/restore |
| Search by title, body and tags | src/model.js, src/app.js | Chromium UI search scenario passed; model queries tested |
| Task notes with completion and due dates | src/app.js, src/model.js | Chromium UI task completion/due-date scenario passed |
| Wiki links, stable-ID references, renamed-note resolution and backlinks | src/model.js, src/app.js | Model unit test and Chromium note-renaming/link-opening scenario passed (run 42245914584) |
| Safe subset Markdown preview | src/app.js | Syntax checked; not full CommonMark |
| Portable JSON and gzip-compressed JSON backup, bounded large-file restore and one-step import undo | src/model.js, src/backup.js, src/storage.js, src/app.js | Node tests cover gzip round-trip above 22 MB, malformed files and bounded decompression; Chromium tested gzip import/undo. Plain JSON ≤22 MB; gzip ≤64 MB decompressed. Full device-quota acceptance pending |
| Responsive dashboard and dark/light design | index.html, assets/styles.css | Six before/after Chromium screenshots reviewed; wrapped mobile title and plus glyph defects corrected; full visual acceptance pending |
| Approximate browser-origin storage quota and optional persistent-storage request | src/app.js | Chromium verified settings control and browser result reporting; storage persistence is never assumed (run 42293110734) |
| PWA metadata and offline shell caching | manifest.webmanifest, sw.js | Chromium reopened the cached shell with networking disabled; native/device install pending |
| No configured server, AI endpoint, telemetry or sync client | Entire source | Static source observation only |

**Boundary:** The tested smoke scenarios are evidenced by GitHub Actions; the complete application has not passed multi-browser acceptance, platform builds, security audit or deployment. Features not above are planned and should not be marketed as shipped.

# GoreeCloud Notebook — Implemented Features (Development Preview)

**Status:** Implemented in source in feature branch, with passing JavaScript syntax, twelve model tests and expanded Chromium UI/storage/backup/offline-shell smoke tests (passing GitHub Actions run 42253559934). Full browser, platform, security and visual acceptance are not established as of November 6, 2026. **Not a stable release.**

| Capability | Owning source | Verification |
| --- | --- | --- |
| Note creation, title/body editing and debounced local saves | src/app.js, src/storage.js | Chromium smoke: create, edit and persist passed |
| IndexedDB local persistence with transactional revision conflict rejection | src/storage.js | Chromium smoke: persisted reload and stale-tab warning passed |
| Nested hierarchy, relocation and cycle prevention | src/model.js, src/app.js | Model cycle checks and Chromium nested-note create/move/parent-option regression passed |
| Favorites, archive, soft trash, restore and duplication | src/app.js, src/model.js | Chromium smoke passed for favorite, duplication, archive/restore, and trash/restore |
| Search by title, body and tags | src/model.js, src/app.js | Chromium UI search scenario passed; model queries tested |
| Task notes with completion and due dates | src/app.js, src/model.js | Chromium UI task completion/due-date scenario passed |
| Wiki links, stable-ID references, renamed-note resolution and backlinks | src/model.js, src/app.js | Model unit test and Chromium note-renaming/link-opening scenario passed (run 42245914584) |
| Safe subset Markdown preview | src/app.js | Syntax checked; not full CommonMark |
| JSON export, validated import, one-step local pre-import undo and oversized-backup warning | src/model.js, src/storage.js, src/app.js | Chromium valid/invalid import, export content, rollback and stale replacement rejection passed; 22 MB import boundary unit-tested |
| Responsive dashboard and dark/light design | index.html, assets/styles.css | Six before/after Chromium screenshots reviewed; wrapped mobile title and plus glyph defects corrected; full visual acceptance pending |
| PWA metadata and offline shell caching | manifest.webmanifest, sw.js | Chromium reopened the cached shell with networking disabled; native/device install pending |
| No configured server, AI endpoint, telemetry or sync client | Entire source | Static source observation only |

**Boundary:** The tested smoke scenarios are evidenced by GitHub Actions; the complete application has not passed multi-browser acceptance, platform builds, security audit or deployment. Features not above are planned and should not be marketed as shipped.

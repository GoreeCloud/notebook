# GoreeCloud Notebook — Implemented Features (Development Preview)

**Status:** Implemented in source in feature branch, with passing JavaScript syntax, 28 model, backup, import-impact, link-integrity and GC UI provenance tests and expanded Chromium UI/storage/backup/offline-shell/cross-tab smoke tests (passing GitHub Actions run 42309149200). Full browser, platform, security and visual acceptance are not established as of November 6, 2026. **Not a stable release.**

| Capability | Owning source | Verification |
| --- | --- | --- |
| Owner-official Notebook mockup first-pass design alignment | docs/OFFICIAL-MOCKUP.md, assets/styles.css, assets/icon.svg, index.html, src/app.js | New workspace starts light, existing dark choice remains, screenshot-derived accessible green accent and notebook mark, responsive three-pane proportions, real note excerpts/tags; tested Chromium and released GC UI Foundations retained. Not a full rich-editor or pixel-match implementation | 
| Note creation, title/body editing and debounced local saves | src/app.js, src/storage.js | Chromium smoke: create, edit and persist passed |
| IndexedDB persistence with revision checks, proactive cross-tab staleness warnings, quota-error reporting and unsaved-exit protection | src/storage.js, src/app.js | Chromium confirms revision-only broadcast, forged-message verification, read-only stale tab, stale-write rejection, simulated quota rollback and unsaved-exit protection (run 42306906700). Tab refocus/visibility also checks committed IndexedDB revision; Chromium verified the no-BroadcastChannel refocus fallback (run 42307504834) |
| Nested hierarchy, relocation and cycle prevention | src/model.js, src/app.js | Model cycle checks and Chromium nested-note create/move/parent-option regression passed |
| Favorites, archive, soft trash, restore and duplication | src/app.js, src/model.js | Chromium smoke passed for favorite, duplication, archive/restore, and trash/restore |
| Search by title, body and tags | src/model.js, src/app.js | Chromium UI search scenario passed; model queries tested |
| Task notes with completion and due dates | src/app.js, src/model.js | Chromium UI task completion/due-date scenario passed |
| Stable-ID wiki links, unique-title resolution/backlinks and read-only broken/ambiguous link audit | src/model.js, src/app.js | Unit tests reject duplicate-title navigation and false backlinks, count broken/ambiguous/convertible links and preserve notes; Chromium confirms the Settings audit leaves saved notes and recovery unchanged (run 42309149200) |
| Safe subset Markdown preview | src/app.js | Syntax checked; not full CommonMark |
| Portable JSON/gzip backups, read-only import impact review, bounded restore and one-step import undo | src/model.js, src/backup.js, src/storage.js, src/app.js | Node tests verify added/changed/retained/removed counts, corrupt backups and bounded gzip; Chromium verifies preview cancellation and checkpoint preservation, import/undo and offline use. Plain JSON ≤22 MB, gzip ≤64 MB decompressed. Full device-quota acceptance pending |
| Responsive dashboard and pinned GC UI Foundations 1.0.1 light/dark/system high-contrast token bridge and canonical focus ring | index.html, assets/styles.css, assets/gc-ui-foundations.v1.css, src/app.js | Exact upstream CSS/license SHA tests; Chromium verified light/dark tokens and OS high-contrast preference changes (run 42303955273); screenshot review performed, full visual/accessibility acceptance pending |
| Approximate browser-origin storage quota and optional persistent-storage request | src/app.js | Chromium verified settings control and browser result reporting; storage persistence is never assumed (run 42293110734) |
| PWA metadata and offline shell caching | manifest.webmanifest, sw.js | Chromium reopened the cached shell with networking disabled; native/device install pending |
| No configured server, AI endpoint, telemetry or sync client | Entire source | Static source observation only |

**Boundary:** The tested smoke scenarios are evidenced by GitHub Actions; the complete application has not passed multi-browser acceptance, platform builds, security audit or deployment. Features not above are planned and should not be marketed as shipped.

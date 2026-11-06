# GoreeCloud Notebook — Implemented Features (Development Preview)

**Status:** Implemented in source in feature branch, with JavaScript syntax and selected model smoke checks completed. Browser-level, CI and visual acceptance are not established as of November 6, 2026. **Not a stable release.**

| Capability | Owning source | Verification |
| --- | --- | --- |
| Note creation, title/body editing and debounced local saves | src/app.js, src/storage.js | Source review; browser pending |
| IndexedDB local persistence | src/storage.js | Source review; reload/storage pending |
| Nested hierarchy, relocation and cycle prevention | src/model.js, src/app.js | Model smoke check passed; tests committed |
| Favorites, archive, soft trash, restore and duplication | src/app.js, src/model.js | Source; browser pending |
| Search by title, body and tags | src/model.js, src/app.js | Source and model tests supplied |
| Task notes with completion and due dates | src/app.js, src/model.js | Source and validation tests supplied |
| Explicit wiki links and title-based backlinks | src/model.js, src/app.js | Source and model tests supplied |
| Safe subset Markdown preview | src/app.js | Syntax checked; not full CommonMark |
| JSON export and validated import | src/model.js, src/app.js | Model roundtrip smoke passed |
| Responsive dashboard and dark/light design | index.html, assets/styles.css | Implemented in source; visual acceptance pending |
| PWA metadata and offline shell caching | manifest.webmanifest, sw.js | Source checked; device install pending |
| No configured server, AI endpoint, telemetry or sync client | Entire source | Static source observation only |

**Boundary:** The functions are present in repository code, but the work has not been verified by real-browser acceptance, platform builds, security audit or deployment. Features not above are planned and should not be marketed as shipped.

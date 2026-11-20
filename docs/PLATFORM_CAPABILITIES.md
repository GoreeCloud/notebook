# Client capability and acceptance matrix — November 2026

This table reflects source and CI behavior in the Notebook development preview,
**not** founder device acceptance, platform certification, production deployment,
or mandatory platform-system integration. The repository contains the canonical
application implementations; GoreeCloud Drive governs project documentation and
GoreeCloud UI design-system authority remains external to Notebook.

| Capability | Web + local API | Qt Quick 6.12 Linux | Android Kotlin/Compose |
| --- | --- | --- | --- |
| Local note edit/search | Yes, web connected to local FastAPI token API | Yes, direct local SQLite | Yes, independent app-private SQLite |
| Offline app without Notebook server | No | Yes | Yes |
| Notebook organization and nested note creation | Yes | Yes | Yes |
| Tags and note revisions/restore | Yes | Yes | Yes |
| Pinned note editing | Yes | Yes, native checkbox with versioned save | Yes |
| Local wiki-link navigation and backlinks | Yes, bounded graph | Yes, first 30 per direction | Yes, first 30 per direction, offline and scoped to local SQLite |
| JSON v2 full export and append-only import | Yes, local bearer-auth service and explicit browser consent | Yes, native file picker, preview and confirmation | Yes, Android Storage Access Framework with preview |
| ENEX import | Text/tags/timestamps only; resources opt-out | Not implemented in native picker | Not implemented |
| Markdown ZIP import and export | Yes, conservative; metadata/media limits | Not implemented in native picker | Not implemented |
| Live SQLite content encryption | No | No | No |
| Optional encrypted SQLite snapshot | Service-side opt-in; synthetic restore | Native opt-in export with optional PyCA; CLI restore only | No |
| Multi-device Mesh synchronization | No | No | No |
| Verified production Identity, GoreeShield, Wardveil enforcement | No | No | No |
| Signed release / end-to-end assistive-tech acceptance | No | No | No |

The web UI has browser-held local development bearer credentials, not a local
offline browser note store or GoreeCloud Identity. Linux can share an on-host
SQLite database with the API when deliberately pointed at the same file; Android
always uses independent sandboxed SQLite. JSON exchange is manual and plaintext,
not automatic sync.

**Validation boundaries:** API SQLite pytest, Vite/React unit/build checks, headless
Qt Quick smoke and native bridge unit tests, and Android debug APK builds run in
required GitHub Actions. Android physical-device instrumentation passed synthetic migration,
JSON import/rollback, 535-note paging and local wiki-link cases; a signed production release, manual Linux
file-picker approval, full keyboard/AT/RTL testing, real family data migration,
and operational off-device recovery are not validated.

**Outstanding fidelity:** Trilium attributes and full ZIP metadata, ENEX/ENML
resources, linked media, note hierarchy UI polishing, complete platform parity,
and conflict-managed encrypted device synchronization. See
[Roadmap](ROADMAP.md), [Linux Parity](LINUX_PARITY.md),
[Android Import](ANDROID_JSON_IMPORT.md), and [Threat Model](THREAT_MODEL.md).


**Validated client-specific improvements:** Linux supports an accessible
pinned-note checkbox with version-checked saves, local wiki links,
SQL-paginated note previews and optional user-confirmed encrypted SQLite
snapshot export (with optional installed crypto; the unsigned .deb has no
bundled compiled PyCA). Android supports SQL-paginated note previews and
offline local wiki links, with synthetic OnePlus N200 tests passing.
Web supports compact preview pages and independently hydrates the full
note before editable fields are mounted, with an unsaved-draft guard for
navigation under review. These are developer-preview behaviors, not human
assistive-tech signoff, end-to-end cross-device sync or privacy policy
certification.

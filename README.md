# GoreeCloud Notebook

An original, MIT-licensed, open-source **self-hosted note and personal knowledge workspace**, taking inspiration from Evernote and Trilium Notes. Not a fork or full feature-parity replacement.

**Status: early development preview (November 2026).** No production deployment, app-store release, signed APK, encrypted **live note store**, or cross-device synchronization has been validated. Optional encrypted offline SQLite snapshots exist, but are not independent disaster-recovery certification.

## Implemented source

| Feature | Web / API | Native Linux | Native Android |
| --- | --- | --- | --- |
| Local notes and search | Yes | Yes | Yes |
| Markdown note editing | Yes, safe preview | Plain-text editor | Plain-text editor |
| Notebooks and nested notes | Yes | Shared SQLite data model | Yes, local schema v3 |
| Tags and revision history | Yes | Yes | Yes; historical export metadata has limitations |
| Wiki-link/backlink navigation | Yes, authenticated local graph | Yes, local graph, first 30 per direction | Yes, offline local graph, first 30 per direction |
| Soft delete and restore | Yes | Soft delete | Soft delete |
| JSON v2 export and append-only import | Web / API with explicit consent | Native offline file picker, confirmation and private plaintext export | Explicit Storage Access Framework import/export |
| Offline editing without server | No | Yes | Yes |

Android stores notes in its own private SQLite DB; Linux and the local API can access the same on-device SQLite file. **They do not synchronize across devices.** Full Trilium-specific ZIP metadata migration, ENEX attachments, full rich-text fidelity, OCR, encrypted **live data**, collaboration and full platform parity are not implemented. Conservative Markdown ZIP and ENEX text imports exist with explicit loss/consent warnings.

## Repository structure

- `server/`: FastAPI + Pydantic + SQLite, bearer authentication, revision history, optimistic concurrency, note hierarchy and tests; authenticated dry-run JSON restore.
- `web/`: React + Vite, Markdown editor and safe preview, indexed local full-text search, tree, tags, trash, revision restore, JSON export and append-only JSON, ENEX text and Markdown ZIP import. System/light/dark and Iris/Lagoon/Ember/Moss appearance controls use pinned GoreeCloud UI tokens (visual acceptance remains open).
- `linux/`: native Qt Quick **6.12.0** graphical client using PySide6 and local SQLite, with native pinned-note editor, wiki links, optional encrypted snapshot export and JSON v2 recovery.
- `android/`: native Kotlin + Jetpack Compose **Material 3 Expressive** client with app-private SQLite, bounded note previews, JSON v2 recovery and offline wiki-link navigation.
- `docs/`: API, architecture, provenance, privacy/security limitations and milestones.
- `design/`: snapshot of authoritative [GoreeCloud UI](https://github.com/GoreeCloud/gc-ui) alpha tokens.
- `.github/workflows/`: CI checks.

## Web quick start (Python 3.12+, Node.js 22+)

```bash
git clone https://github.com/GoreeCloud/notebook.git
cd notebook
python3 -m venv .venv
.venv/bin/pip install -r server/requirements.txt
export GC_NOTEBOOK_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(36))')"
PYTHONPATH=server .venv/bin/uvicorn notebook.main:app --host 127.0.0.1 --port 8000
```

In another terminal, `cd notebook/web && npm ci && npm run dev`, then browse to `http://127.0.0.1:5173`. Enter the API URL `http://127.0.0.1:8000` and the generated bearer token. The token stays in web application memory and must be entered again if the page reloads.

**Never send that token in email, public chat, query strings or a source commit.** The API requires a random secret of 24+ characters; 127.0.0.1 is the intended bind address. Do not expose this development endpoint to the internet.

## Native Linux

With the Python venv created above, run `.venv/bin/pip install -r linux/requirements.txt && ./linux/run.sh`. Requires a working Linux desktop session and Qt 6.12 libraries. The default SQLite path is `~/.local/share/goreecloud/notebook/notes.sqlite3` (or `$XDG_DATA_HOME/goreecloud/notebook/notes.sqlite3`). No server or login is needed.

For optional native **encrypted SQLite export**, install the pinned extra crypto requirements with `.venv/bin/pip install -r server/requirements-crypto.txt`. The live database remains plaintext; independent restore and secure off-device backup are not production-accepted. See [Native Linux Encrypted Backup](docs/LINUX_ENCRYPTED_BACKUP.md).

The repository also includes an **experimental unsigned x86_64 .deb builder** in `scripts/build_linux_deb.py`. It bundles Qt 6.12.0 dynamic libraries and is not a production release or verified installation. See [Linux Packaging](docs/LINUX_PACKAGING.md) and its explicit redistribution review gate.

## Native Android

Open `android/` with Android Studio and JDK 21; build with `cd android && ./gradlew :app:assembleDebug`. The Android app requires **no INTERNET permission**, does not use a WebView, and stores notes in its own sandbox. It supports explicit plaintext JSON v2 import/export through Android Storage Access Framework, but no remote sync, automatic backups, app-at-rest encryption or full cross-platform parity. See [Android Data](docs/ANDROID_DATA.md) and [Android JSON Import](docs/ANDROID_JSON_IMPORT.md). Successful GitHub Android CI builds publish a **debug-only APK** as a short-lived Actions artifact (not a production-signed release). An isolated OnePlus N200 instrumentation run passed synthetic recovery, 535-note paging and local wiki-link cases; human UI accessibility and application upgrade acceptance remain outstanding. See [Physical-device evidence](docs/evidence/android-physical-regression-2026-11-20.md).

## Validation

```bash
PYTHONPATH=server .venv/bin/pytest -q server/tests
cd web && npm ci && npm run build
cd ../android && ./gradlew :app:assembleDebug
cd .. && QT_QPA_PLATFORM=offscreen GC_NOTEBOOK_SMOKE=1 .venv/bin/python linux/main.py
```

Tests, builds and virtual-display smoke checks **do not establish hardware, packaging, recovery or production acceptance**.

## Security, privacy, integration and licensing

There is no telemetry in first-party source; API access uses a **single local bearer token**, not the mandatory GoreeCloud Identity platform. The **live** SQLite store is not encrypted at rest; optional authenticated encrypted SQLite snapshots have synthetic restore tests, but independent off-device disaster-recovery rehearsal has not been completed. JSON archives can now be imported in a validated, append-only operation, but device-loss backups and external restore drills are unverified. The web preview does not enable raw HTML rendering. Android cloud backup is disabled. See [SECURITY.md](SECURITY.md) and [Threat Model](docs/THREAT_MODEL.md).

GoreeCloud UI is the source of design truth. GoreeCloud Mesh integration, GoreeShield privacy controls, GoreeCloud Identity authorization, and Wardveil security monitoring remain specified future integration work; do not treat the architecture as enforcement.

Original first-party code uses [MIT](LICENSE). Dependencies retain their own upstream licenses and attribution in [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md). **No code from Evernote, Trilium or AFFiNE was copied.** See [Architecture](docs/ARCHITECTURE.md), [API](docs/API.md) and [Roadmap](docs/ROADMAP.md); see [JSON Recovery](docs/RECOVERY.md) for restore behavior and limits, and [Encrypted Offline Backup](docs/ENCRYPTED_BACKUP.md) for optional authenticated local snapshots.

Optional local privacy audit: [read-only SQLite file/sidecar permission inspection](docs/LOCAL_FILE_PERMISSIONS.md). No automatic permission changes or note-content access.

Linux: the native Qt Quick client supports notebook filtering/creation, nested-note creation, comma-separated tags, revision history, local wiki-link navigation and JSON v2 import/export, with user-data-isolated Qt smoke tests. Full hierarchy, parity and packaging acceptance remain open. See [Linux Parity](docs/LINUX_PARITY.md).

Linux Qt Quick now exposes [offline portable JSON v2 recovery](docs/LINUX_JSON_RECOVERY.md), with explicit import preview/confirmation and private, **unencrypted** export. User-facing file-picker accessibility and manual validation remain outstanding.

Web, Linux and Android can resolve local links within their respective local stores via unique same-notebook `[[Title]]` notation or stable `[[note:UUID|label]]` links. Authenticated link-graph API and web linked-note navigation are documented in [Local Wiki Links](docs/LINKS.md).

Large local libraries can load beyond the first 500 records through the [bounded local notes page API](docs/NOTE_PAGINATION.md), body-minimized web preview browsing, and explicit web/Linux/Android **Load more notes** controls. Paging is offset-based and not a stable snapshot under concurrent edits.

For a source-grounded, per-client acceptance matrix, see [Platform Capabilities](docs/PLATFORM_CAPABILITIES.md).

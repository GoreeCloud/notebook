# GoreeCloud Notebook

An original, MIT-licensed, open-source **self-hosted note and personal knowledge workspace**, taking inspiration from Evernote and Trilium Notes. Not a fork or full feature-parity replacement.

**Status: early development preview (November 2026).** No production deployment, app-store release, signed APK, data encryption, or cross-device synchronization has been validated.

## Implemented source

| Feature | Web / API | Native Linux | Native Android |
| --- | --- | --- | --- |
| Local notes and search | Yes | Yes | Yes |
| Markdown note editing | Yes, safe preview | Plain-text editor | Plain-text editor |
| Notebooks and nested notes | Yes | Shared SQLite data model | Not yet |
| Tags, revisions, backlinks | Yes | Partial (data model) | Not yet |
| Soft delete and restore | Yes | Soft delete | Soft delete |
| JSON export and append-only restore | Web / API | Via local API | Not yet |
| Offline editing without server | No | Yes | Yes |

Android stores notes in its own private SQLite DB; Linux and the local API can access the same on-device SQLite file. **They do not synchronize across devices.** Trilium ZIP migration, ENEX attachments and full rich-text fidelity, OCR, encryption, collaboration and full platform parity are not implemented.

## Repository structure

- `server/`: FastAPI + Pydantic + SQLite, bearer authentication, revision history, optimistic concurrency, note hierarchy and tests; authenticated dry-run JSON restore.
- `web/`: React + Vite, Markdown editor and react-markdown preview, search, tree, tags, trash, revision restore, JSON export and validated append-only JSON import plus opt-in ENEX text migration and basic Markdown ZIP folder imports.
- `linux/`: native Qt Quick **6.12.0** graphical client using PySide6 and local SQLite.
- `android/`: native Kotlin + Jetpack Compose **Material 3 Expressive** client with app-private SQLite.
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

## Native Android

Open `android/` with Android Studio and JDK 21; build with `cd android && ./gradlew :app:assembleDebug`. The Android app requires **no INTERNET permission**, does not use a WebView, and stores notes in its own sandbox. It does not yet support backups, cross-device access or encryption at the application layer. Successful GitHub Android CI builds publish a **debug-only APK** as a short-lived Actions artifact (not a production-signed or device-validated release).

## Validation

```bash
PYTHONPATH=server .venv/bin/pytest -q server/tests
cd web && npm ci && npm run build
cd ../android && ./gradlew :app:assembleDebug
cd .. && QT_QPA_PLATFORM=offscreen GC_NOTEBOOK_SMOKE=1 .venv/bin/python linux/main.py
```

Tests, builds and virtual-display smoke checks **do not establish hardware, packaging, recovery or production acceptance**.

## Security, privacy, integration and licensing

There is no telemetry in first-party source; API access uses a **single local bearer token**, not the mandatory GoreeCloud Identity platform. SQLite data is **not encrypted at rest** and application-level disaster recovery has not been tested. JSON archives can now be imported in a validated, append-only operation, but device-loss backups and external restore drills are unverified. The web preview does not enable raw HTML rendering. Android cloud backup is disabled. See [SECURITY.md](SECURITY.md) and [Threat Model](docs/THREAT_MODEL.md).

GoreeCloud UI is the source of design truth. GoreeCloud Mesh integration, GoreeShield privacy controls, GoreeCloud Identity authorization, and Wardveil security monitoring remain specified future integration work; do not treat the architecture as enforcement.

Original first-party code uses [MIT](LICENSE). Dependencies retain their own upstream licenses and attribution in [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md). **No code from Evernote, Trilium or AFFiNE was copied.** See [Architecture](docs/ARCHITECTURE.md), [API](docs/API.md) and [Roadmap](docs/ROADMAP.md); see [JSON Recovery](docs/RECOVERY.md) for restore behavior and limits.

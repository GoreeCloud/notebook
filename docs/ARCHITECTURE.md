# Architecture and MIPS responsibilities

```text
React/Vite browser --Bearer/HTTP--> FastAPI REST --> SQLite (local)
Qt Quick 6.12 native Linux ------------local----> SQLite (same host/account)
Kotlin/Compose Material 3 Expressive Android --> SQLite (Android app sandbox)
```

This is an **offline-native local-first foundation**, not synchronized multi-device software. Canonical document content is UTF-8 Markdown. Each note has a UUID, optional parent ID, tags, version counter, soft-delete timestamp and revision history on the service database. SQLite owns transactions and foreign key validation. Android retains a separate SQLite v3 schema with notebooks, parent-child note relationships, revisions and explicit plaintext JSON export.

The web API binds to loopback in the documented command and requires a random shared bearer token. No user account or remote access control is implemented. Do not use an external bind address without reviewed authentication, authorization, HTTPS, rate limits and deployment gates.

Mandatory platform systems:
- **GoreeCloud UI:** verified visual tokens from `GoreeCloud/gc-ui`; Android Material 3 Expressive and Linux Qt Quick 6.12.
- **GoreeCloud Mesh:** future authorized note sync and cross-product data exchange; no live channel yet.
- **GoreeCloud Identity:** future notebook-scoped users and permissions; shared secret is temporary development auth.
- **GoreeShield:** future consent, retention, user ownership and data-minimized exports.
- **Wardveil:** future threat scanning, policy checks, auditing and incident response.

Future synchronization should use signed, encrypted note change logs with explicit sharing policies, robust client cursors and tested conflict recovery. Evaluate Yjs collaboration after separate security/performance review; not part of current source.

## Local data portability

The JSON v2 export includes all notebooks, notes (including Trash), and saved revisions, unlike the older v1 export. An authenticated v1/v2 importer validates type, size, UUID references, parent cycles, tags, timestamps and revision version ranges before writing in one SQLite transaction. Dry-run does not change storage. Imports append only and assign new UUIDs to prevent collisions and overwrite. Binary attachments, user account ACLs and encrypted backup are not part of the format. See [JSON Recovery](RECOVERY.md).

## Incremental local events

SQLite triggers capture note mutations in a monotonic `note_change_events` table. An authorized local `GET /api/v1/changes` endpoint paginates event metadata for future Mesh design. This is not a trusted remote replication channel and does not enforce GoreeShield/Identity sharing, Wardveil network checks or conflict resolution. See [Local Changefeed](LOCAL_CHANGEFEED.md).

## Search index

The SQLite service database has a derived local `notes_fts` virtual table with SQL triggers on note insert/update/delete. The authenticated `GET /api/v1/search` endpoint performs prefix-token matching and weighted ranking without accepting raw FTS query operators. It excludes soft-deleted notes; first run backfills existing active notes. SQLite builds lacking FTS5 fall back to a capped LIKE search. Index data is plaintext and never leaves the local service by default. See [Indexed Local Search](SEARCH.md).

## Android native schema and export

Android schema v3 stores stable notebook IDs, optional parent relationships, note timestamps and local revisions with a sequential v1→v2→v3 migration path. User-confirmed Android Storage Access Framework JSON v2 export is plaintext, contains note content and revisions, and is compatible with service append-only imports subject to lossy historical tags/pinning. Android remains separately sandboxed with no network permission or automatic backup. It now supports locally validated, append-only JSON v2 document import with preflight and explicit consent; see [Android JSON Import](ANDROID_JSON_IMPORT.md). See [Android Data](ANDROID_DATA.md).

## Linux native notebook scope

The Qt Quick bridge maps existing service SQLite notebook IDs and optional parent-note references to native notebook selection, notebook creation, child-note creation and tag edits. No additional Linux database format or network transport was introduced. Qt smoke mode uses disposable SQLite exclusively. See [Linux Parity](LINUX_PARITY.md).

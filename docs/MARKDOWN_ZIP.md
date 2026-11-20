# JSON archive recovery (development preview)

**Export:** Use the browser **Export JSON** command or authenticated `GET /api/v1/export`. The returned `goreecloud-notebook-v2` object contains notebook metadata, notes (including soft-deleted notes), and stored prior note revisions. This archive is **plaintext**; save it only to a trusted private location. Local JSON export is not a substitute for tested encrypted backups.

**Restore:** In the browser choose **Import JSON**; the app validates the file, requests an API dry run and asks for explicit confirmation before committing any changes. The local API accepts `POST /api/v1/import` with `{"document": <export>, "dry_run": true}`, then a second explicit request with `"dry_run": false`. This operation appends new notebooks and notes; it **never overwrites** existing data. All imported notebook/note IDs are remapped while preserving hierarchy and history. Reimporting intentionally creates duplicates.

**Constraints:** Only JSON formats `goreecloud-notebook-v1` and `goreecloud-notebook-v2` are supported. The server rejects archives over 8 MiB, over 200 notebooks, 2,000 notes or 10,000 revision records, invalid UUIDs, missing references, cycles, malformed timestamps, oversized fields and invalid tags. The entire import commits or rolls back atomically after validation. Import does not yet preserve stable IDs across devices, support attachments, encrypted exports, Trilium export files, Evernote ENEX, Markdown directories or ZIP files.

**Acceptance evidence:** Synthetic round-trip and malicious-input rejection tests live in `server/tests/test_transfer.py`. A complete disaster recovery rehearsal from a lost or damaged device **has not yet been performed**. Do not delete the original data or backups after a successful dry run or test import.

## Markdown ZIP portability

Import a ZIP of UTF-8 Markdown files via the web interface or `POST /api/v1/import/markdown-zip`. The server creates empty folder notes and retains the ZIP directory hierarchy; no archive contents are extracted to disk. The ZIP's non-Markdown content, media, Trilium metadata, IDs and internal references are **not migrated**. Those entries cause rejection by default; explicit `skip_unsupported=true` allows text-only import after a separate warning/confirmation. This is compatible with basic Markdown ZIP exports from TriliumNext, not a lossless native Trilium archive restoration. Keep original exports untouched. See [Markdown ZIP Import](MARKDOWN_ZIP.md).


## Plaintext export (first-party compatibility)

The web sidebar now offers **Export Markdown ZIP**, requiring explicit confirmation that the ZIP is **plaintext** and **loses tags, pinned state, prior revisions, Trash contents and attachment metadata**. The authenticated API endpoint is `GET /api/v1/export/markdown-zip`. It returns a ZIP archive containing active Markdown notes; it does not write any archive files to the server's disk.

Each note file includes a short HTML comment containing a reversible encoded title so the first-party importer can recover exact titles. An exported parent note is represented by both `Parent--<uuid>.md` and a same-stem folder `Parent--<uuid>/` containing its child note files. The importer now treats a matching Markdown file as the folder's own parent note rather than creating an empty duplicate. Plain Markdown folders with no matching note file still become synthetic parent notes. Multiple notebooks are separated into top-level folders and may create additional placeholder note nodes on re-import; only JSON v2 retains full notebook identity.

Limits remain a maximum of 8 MiB compressed, 8 MiB of original Markdown content, 2,000 active notes and bounded path nesting. An empty set of active notes returns 422 instead of an empty, misleading backup. All exports are protected by the temporary local API bearer token and `Cache-Control: no-store`.

**Use JSON v2 or the local SQLite snapshot for recovery.** Markdown ZIP export is designed for readable migration, not a lossless backup or secure encrypted export. Preserve your original archives and test the receiving application before discarding any data.

# JSON archive recovery (development preview)

**Export:** Use the browser **Export JSON** command or authenticated `GET /api/v1/export`. The returned `goreecloud-notebook-v2` object contains notebook metadata, notes (including soft-deleted notes), and stored prior note revisions. This archive is **plaintext**; save it only to a trusted private location. Local JSON export is not a substitute for tested encrypted backups.

**Restore:** In the browser choose **Import JSON**; the app validates the file, requests an API dry run and asks for explicit confirmation before committing any changes. The local API accepts `POST /api/v1/import` with `{"document": <export>, "dry_run": true}`, then a second explicit request with `"dry_run": false`. This operation appends new notebooks and notes; it **never overwrites** existing data. All imported notebook/note IDs are remapped while preserving hierarchy and history. Reimporting intentionally creates duplicates.

**Constraints:** Only JSON formats `goreecloud-notebook-v1` and `goreecloud-notebook-v2` are supported. The server rejects archives over 8 MiB, over 200 notebooks, 2,000 notes or 10,000 revision records, invalid UUIDs, missing references, cycles, malformed timestamps, oversized fields and invalid tags. The entire import commits or rolls back atomically after validation. Import does not yet preserve stable IDs across devices, support attachments, encrypted exports, Trilium export files, Evernote ENEX, Markdown directories or ZIP files.

**Acceptance evidence:** Synthetic round-trip and malicious-input rejection tests live in `server/tests/test_transfer.py`. A complete disaster recovery rehearsal from a lost or damaged device **has not yet been performed**. Do not delete the original data or backups after a successful dry run or test import.

## Markdown ZIP portability

Import a ZIP of UTF-8 Markdown files via the web interface or `POST /api/v1/import/markdown-zip`. The server creates empty folder notes and retains the ZIP directory hierarchy; no archive contents are extracted to disk. The ZIP's non-Markdown content, media, Trilium metadata, IDs and internal references are **not migrated**. Those entries cause rejection by default; explicit `skip_unsupported=true` allows text-only import after a separate warning/confirmation. This is compatible with basic Markdown ZIP exports from TriliumNext, not a lossless native Trilium archive restoration. Keep original exports untouched. See [Markdown ZIP Import](MARKDOWN_ZIP.md).

## Explicit data-portability choices

- **JSON v2** is the richer authenticated archive format with tags, note revision history, deleted-state metadata and notebook IDs (restored with new IDs).
- **Markdown ZIP** is a deliberate plaintext active-note export that preserves basic text, titles and parent-note structure but omits history, tags, pinning, Trash and attachments. Never treat it as a complete backup.
- **SQLite snapshot** is the local native database backup with all service metadata; secure the plaintext file off-device before relying on it for disaster recovery.

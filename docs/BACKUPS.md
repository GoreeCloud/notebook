# GoreeCloud Notebook — Backups and Recovery

**Scope:** GoreeCloud Notebook v0.1 development preview. All backups are explicit user exports, not automatic cloud copies. The browser stores notes locally; exports are **not encrypted** by Notebook.

## Exporting

Open **Settings → Export backup**. The export includes all notes, including archived and trashed notes.

- At **22,000,000 bytes or smaller**, Notebook downloads an ordinary UTF-8 `.json` file.
- Above that size, when the browser supports the standard `CompressionStream` and `DecompressionStream` APIs, Notebook downloads **`.json.gz`**. This is regular JSON inside standard gzip, not a proprietary file format.
- If the browser cannot create gzip, it exports ordinary JSON but warns when that file exceeds the available plain-JSON import limit.
- If the JSON before compression exceeds **64,000,000 bytes**, or the gzip exceeds **66,000,000 bytes**, the export is marked **not restorable by this preview** even if a compressed file is downloaded. Preserve it for external/manual recovery; do not depend on the in-app restore pathway.

**Recommendation:** Save backups outside the browser profile on a protected device or encrypted external storage. Check that the file exists and can be imported in a **separate disposable browser profile** before deleting source notes.

## Importing a backup

Open **Settings → Import backup** and select a `.json` or `.json.gz` file. The app validates note IDs, types, body length, titles, tags, optional flags, date fields, hierarchy and backup schema, then displays a **read-only import impact summary** (current and incoming totals; added, modified, unchanged and removed notes). Its comparison includes archived and trashed notes. Matching note IDs are compared using note contents, types, tags and hierarchy rather than volatile timestamps. **Cancel** performs no replacement and leaves the one-step recovery checkpoint unchanged. Only after confirmation can a revision-checked IndexedDB replacement occur. Only a confirmed, valid import reaches the IndexedDB replacement transaction.

- **Plain JSON:** Up to **22,000,000 bytes**.
- **Gzip JSON:** Up to **66,000,000 compressed bytes**, with an enforced **64,000,000 decompressed-byte limit**. Malformed gzip and oversized decompressed content are rejected before replacement. Gzip import needs the browser's `DecompressionStream` API.
- **Unsupported:** Whole-workspace backups exceeding the gzip limits, incomplete/corrupt backups, unknown schema versions or invalid hierarchies. Supplied malformed note metadata is rejected rather than silently discarding tags, renaming titles or clearing due dates; missing legacy v1 optional metadata remains compatible. Malformed UTF-8 in either plain JSON or gzip JSON is also rejected without silently rewriting note text.

Imports use atomic revision checks to prevent a stale tab from replacing newer saved data. They also preserve **one pre-import workspace checkpoint** in the same IndexedDB transaction. **Settings → Undo last import** can restore that previous snapshot. A later import or undo replaces the checkpoint; it is not a full version history or an off-device backup.

## What the tests demonstrate

- Node.js tests generate and restore a gzip file containing more than **22 MB of uncompressed JSON**, preserving note IDs and bodies.
- Additional tests reject invalid gzip and notes violating validation rules.
- Chromium UI smoke tests import `.json.gz` and undo it through Settings.
- Tested failure paths do not claim recovery from actual disk exhaustion, browser storage eviction, device loss, corruption of the browser profile or a power failure.

## Privacy and recovery limits

JSON and gzip are **plaintext formats**: gzip provides compression, not encryption. Anyone able to read the files can extract their contents. No remote upload, cloud sync or AI ingestion is performed by the backup functions. The app still stores one whole-workspace snapshot, so very large restores may exceed device RAM or browser storage quotas even below the format limits.

Retain independent backups, use a trusted storage location and avoid importing untrusted files. Full streaming note storage, advanced restore tooling and broader multi-device validation remain planned.

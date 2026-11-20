# Native Linux JSON recovery — local development preview

GoreeCloud Notebook Qt Quick 6.12 now provides **Import JSON (offline)** and **Export JSON (plaintext)** from its sidebar. These are manual local operations, not GoreeCloud Mesh replication, cloud sync or encrypted disaster recovery. They reuse the same verified service JSON v2 transfer format as the web API and native Android app, including nested notes, tags, pinned state, Trash and previous note revisions.

## User workflow

1. For import, select **Import JSON (offline)** and choose a local `.json` archive through the system file picker. The app rejects network URLs, symlink final targets, non-regular files, malformed UTF-8, invalid structure, unsupported formats and archives exceeding 8 MiB. No note mutation takes place during this stage.
2. Review the reported notebook, note and revision counts. Confirm to append the imported content as **new** notebooks/notes/revisions with newly allocated IDs, or cancel to leave all notes unchanged. The app applies the *already validated in-memory archive*, not a second read of a file that could have changed after preview.
3. The canonical server import function creates the records inside **one SQLite transaction**. Invalid references, cycles, and a failed write abort the entire import; existing notes are never overwritten. Existing notes cannot be silently deduplicated or merged with source IDs. The native notebook and note lists are refreshed after success.
4. For export, select **Export JSON (plaintext)**. The app explicitly warns that it includes **all notes (including Trash), revisions and notebook contents without encryption**. Pick a new destination; existing paths are never overwritten, the created file is restricted to mode **0600** on Linux, content is capped at 8 MiB, and the export serialization is performed before creating a destination. If the save fails, a partial file created by this operation is cleaned up only after checking that its inode still matches.

**Snapshot consistency:** The shared JSON exporter now begins an explicit SQLite read transaction before fetching notebooks, notes and revisions; those three tables come from the same database snapshot even if other threads modify notes during export.

**Safety limits:** 8 MiB JSON text, 200 notebooks, 2,000 notes, 10,000 revisions, nested-note parents validated, field sizes limited by `server/notebook/transfer.py`. An archive that exceeds the size limit is refused; use appropriate independent SQLite backups for larger archives. This function is not a filesystem or cloud backup policy. The file-picker provider and final destination may be controlled by another application; choose a trusted local directory.

**Implementation:** `linux/recovery.py`, the Qt `Bridge` in `linux/main.py`, native file/confirmation dialogs in `linux/qml/Main.qml`, shared validation/import/export in `server/notebook/transfer.py`. The experimental unsigned `.deb` packaging builder includes these modules and the extracted-package smoke checks they are present. No extra network permission, account state, telemetry or database schema is introduced.

**Verification:** The synthetic Linux recovery tests cover export file mode, round-trip notebook hierarchy and revisions, preview without a write, cancellation, a changed source file after preview, invalid UTF-8/JSON, over-limit archives, symlink refusal, existing-file overwrite refusal and rejection of non-local URLs. Qt smoke can load the new QML view headlessly with disposable data. CI exercises tests/package extraction but does not constitute human file-picker, desktop accessibility or multi-platform large-archive acceptance.

**Open gates:** Human import/export dialogs, Linux screen-reader and keyboard interaction, fidelity with real user exports, large dataset performance, signed Linux release, automatic sync, encrypted live SQLite and full GoreeShield/Wardveil/Identity controls.

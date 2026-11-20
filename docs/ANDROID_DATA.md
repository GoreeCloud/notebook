# Native Android SQLite v3 and user-directed data export

The Android client remains fully local, uses a private app SQLite database, declares **no INTERNET permission**, and has `allowBackup=false`. It is **not** synchronized with the web/Qt service database. Android versionCode **2** uses schema **3**:

- A first-class `notebooks` table with persistent UUIDs, names and creation timestamps.
- Every note receives a notebook ID and optional parent-note UUID, plus creation/update timestamps.
- The editor can select or create notebooks, and add nested child notes.
- Existing schema **v1** upgrades sequentially through **v2** (tags/pinning/revisions) and **v3**. Existing v2 notes are assigned to a default notebook; their stored `updated_at` timestamps are reused as approximate creation dates because older schemas did not track creation times. Notes and revisions are not deleted by migrations.
- Note edits remain optimistic-versioned and transactional. Restoring a deleted child requires its parent to be active. Trashing a parent preserves its child links, matching the local service.

## Explicit plaintext JSON export

Choose **Export JSON** from the Android app. The confirmation explains that this file contains all notebooks, note bodies, tags, Trash and revision text **without encryption**. The Android Storage Access Framework then lets the user choose a destination, which may be managed by a cloud provider; the app itself has no network permission and never chooses a destination in the background. Export runs on an I/O worker and is limited to an 8 MiB JSON v2 archive.

The exported schema follows `goreecloud-notebook-v2` and can be imported by the server's validated append-only JSON importer, subject to its existing size/count checks. **Limitations:** Android's old revision model stored historical tags and pin states; JSON v2 only represents historical title/body, so those older revision attributes are not round-tripped. Imported Android notes will receive new IDs on the web service, not merge by original UUID. There is **no Android JSON restore/import yet**, no app-at-rest encryption and no automatic backup. Keep separate protected copies and verify a restore on the receiving system.

## Acceptance evidence and open gates

**Synthetic physical-device migration verified November 20, 2026:** On the connected OnePlus N200 (Android API 36), a previously built schema-v2 debug APK was installed, seeded with a synthetic note and a previous revision, and backed up privately before updating to this versionCode-2 debug APK with the same signing certificate. The new app launched with its process alive, the schema upgraded to v3, one notebook/one note/one revision remained, the note received a notebook ID and derived creation timestamp, and SQLite reported no foreign-key defects. This first exercise verified **v2 → v3**, not the earliest v1 upgrade or all UI behavior. The private pre-upgrade test-only SQLite snapshot is kept outside this repository on the authorized laptop; no personal notes were inserted in the test.

**Separate v1 → v3 synthetic hardware acceptance, November 20, 2026:** A locally generated copy of the original schema-v1 notes table and index was seeded with one synthetic note only. A private 0600 recovery snapshot of the prior **synthetic** v3 database was verified before testing. The v1 fixture was loaded into the app's sandbox on the authorized USB-connected OnePlus N200 (API 36), then the already-installed versionCode-2 APK was started. Android upgraded from SQLite `user_version=1` to `user_version=3` through both migrations: one notebook, one preserved synthetic note, zero previous revisions (as expected for v1). The note had a nonnull notebook ID, derived creation timestamp, empty tags and pinning disabled; `PRAGMA foreign_key_check` reported no violations. The test-specific v3 database was then restored; readback again reported schema v3 with one notebook, one earlier synthetic v2→v3 note and one earlier revision, and the device's staging files were deleted. Device command evidence is private and not committed; **no personal notes were opened, exported or changed**.

An optional **read-only** developer verification script, `scripts/verify_android_schema.sh <adb-serial>`, reports only schema version, row counts, and foreign-key integrity from an already-installed debug APK. It does not alter the device.

CI assembles the Android debug APK; full physical note editing, Android Storage Access Framework file-picker export, real-world restore rehearsals, and human/assistive-technology accessibility should still be tested independently. Native Android is not considered a full parity release until human interaction tests, assistive-technology testing, protected backups/imports and cross-device Mesh security are complete.

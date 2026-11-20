# Android JSON v2 import — development preview

The Android native Notebook now has a **user-directed, offline JSON v2 import** through Android's Storage Access Framework document picker. The file is selected explicitly by the user; the app does not use INTERNET permission, does not automatically watch a folder, and does not upload private note content. The selected document provider may itself access cloud files.

## Safe workflow

1. In the main notebook screen choose **Import JSON** and select a `.json` file from a trusted local document provider.
2. The app reads at most 8 MiB into private app memory, rejects malformed UTF-8/JSON and deeply nested documents, and displays a **dry-run** count of notebooks, notes and revisions without writing anything.
3. Review the counts, the source's privacy implications, and the **append-only** behavior. Confirm to import or Cancel to leave all existing notes untouched.
4. On confirmation, records are mapped to **new UUIDs** and appended inside one SQLite transaction; on any parse/constraint error the transaction rolls back. The app switches to the newly imported notebook so the records are visible.

The importer accepts only `goreecloud-notebook-v2`. It validates UUIDs, uniqueness, notebook membership, parent existence and cycles, timestamps with explicit timezone, note and revision version bounds, tag items, metadata types, and parsed JSON nesting. Bounds: 8 MiB, 200 notebooks, 2,000 notes, 10,000 revisions, 32 parent levels, and 64-character tag items. The native Android schema currently stores tags in a comma-delimited string; comma-containing tags are **rejected** rather than silently corrupted. Files larger than the limit or with unsupported metadata are explicitly refused.

This provides an Android **import path** for JSON v2 exports from GoreeCloud Notebook's authenticated local API or Android export. It does not support v1 JSON, Evernote ENEX, Trilium-native archives, Markdown ZIP, binary attachments, or automatic cloud sync. It does not merge matching source IDs or deduplicate repeated imports, and cannot reconstruct historical Android revision tags/pin state absent from JSON v2.

## Security and validation boundaries

Imported JSON is untrusted input and is parsed before any SQLite mutation. The app has no network permission and the test-only import instrumentation is **excluded from the user APK**; its isolated named test database is deleted after completion, so it never touches `notebook.db`. It tests dry-run, parent/child remapping, revision round-trip, malformed parent rejection and synthetic SQL-trigger rollback on a connected authorized device when explicitly run. **Physical-device acceptance verified on November 20, 2026:** The isolated Android instrumentation APK completed on the authorized USB-connected OnePlus N200 (Android API 36) with `INSTRUMENTATION_CODE: -1` and an explicit PASS result. It exercised the JSON v2 export → dry-run → append-only import → note tree/revision verification path, malformed-reference refusal and an intentional SQLite trigger failure to verify rollback. Before and after instrumentation, the actual `notebook.db` remained at schema v3 with one prior synthetic notebook, one prior synthetic note and one revision, with no foreign-key defects. The harness removed its isolated named test database. **This does not test human SAF file picker workflows or production release acceptance.**

GitHub CI compiles the test APK; CI without a physical device **does not execute the instrumentation acceptance test**.

Run on an authorized USB-connected Android device only, after verifying the target is the development APK:

```sh
cd android
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest
adb -s <explicit-device-serial> install -r app/build/outputs/apk/debug/app-debug.apk
adb -s <explicit-device-serial> install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s <explicit-device-serial> shell am instrument -w   com.goreecloud.notebook.test/com.goreecloud.notebook.NotebookImportInstrumentation
```

The instrumentation creates a uniquely named private test-only database, validates its records and transaction rollback, then deletes that database. It does not grant release acceptance or verify actual human file-picker interaction, mobile accessibility, app-layer encryption, device backup recovery, or Mesh synchronization. Ordinary native SQLite storage and plaintext user exports remain unencrypted. Appropriate GoreeShield consent, Wardveil protections, and GoreeCloud Identity access policy remain future integration work.

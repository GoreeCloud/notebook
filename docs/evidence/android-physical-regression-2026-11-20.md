# Synthetic physical-device regression evidence — November 20, 2026

Authorized Linux-connected **OnePlus N200 (DE2117, Android API 37)** was used
for an isolated **debug-only Android instrumentation run**. The prior system
package inventory showed no installed or retained com.goreecloud.notebook
package, so installation would not replace an existing Notebook application
or its data. APKs were built locally from the current change worktree.

The instrumentation uses a uniquely generated notebook-test-UUID.db SQLite
database, never the normal notebook.db. The verified output was:

    INSTRUMENTATION_RESULT: result=PASS: append-only JSON roundtrip, rollback, 535-note paging, Trash and local wiki links
    INSTRUMENTATION_CODE: -1

Test scope included append-only JSON v2 source/import/preview and revisions;
malformed archive rejection and transaction rollback; 535 synthetic note bulk
seeding and three 200-item browse pages; full-body note lookup rather than
truncated preview; Trash filtering and invalid bounds; Unicode case-folded
title resolution, stable cross-notebook UUID references, ambiguous-title
refusal and deleted-target exclusion.

The script uninstalled **both newly installed app and test packages** after
the run. A final Android package inventory confirmed no retained Notebook
packages. The entire test used synthetic data, did not read the ordinary
Notebook profile and made no changes to unrelated applications.

**Not covered:** actual Compose Links dialog interaction, human keyboard,
TalkBack/screen-reader, offline/online toggles, real-person notes, release APK
signing, app-store release, service/Android synchronization, cross-device
encryption, or production security acceptance. Continuous device testing is
not configured; this is one operator-run check with explicit cleanup.

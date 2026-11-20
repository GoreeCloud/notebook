# Native Android client — Kotlin + Material 3 Expressive

The Android development preview is a genuine local-first Compose app, not a WebView. Version 2 of the private SQLite schema adds tags, pinned notes and per-note revision history while migrating existing version 1 notes in place. Notes can now be searched by tag, pinned, moved to Trash and restored; earlier text revisions can be restored as new revisions. Edit conflict checks reject stale writes.

Android's app-private database is **independent** from the web/Linux database. No network permission, cloud sync, end-to-end encryption, file attachments, cross-platform restore format, background sync or production authentication are implemented.

## Validation

```sh
cd android
./gradlew :app:assembleDebug
```

This builds a debug APK using the repository's Gradle wrapper. It does not attest installation, operating-system lifecycle behavior, migration on a real version 1 device, signed release, backup recovery or accessibility. Do not uninstall the app to test until existing on-device notes are backed up; the app currently disables Android automatic backup.

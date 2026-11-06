# GoreeCloud Notebook — Security and Privacy

**Development preview, not production security-certified.**

## Existing safety properties

- All notes remain in browser IndexedDB; no backend, analytics or third-party AI endpoint is configured.
- Browser CSP disallows third-party scripts, remote connections, object embeds and uncontrolled form destinations.
- UI output escapes note titles, content and tags before inserting HTML.
- Markdown preview supports a limited set of formatting patterns without enabling arbitrary user HTML.
- Portable JSON imports validate the schema, bounded note bodies, unique IDs and cycle-free hierarchy before overwrite confirmation. Full-workspace replacements also preserve the previous validated snapshot as a one-step local recovery checkpoint in the same IndexedDB transaction.
- Remote JavaScript plugins, dynamic execution and public publication are not included.
- The application shell can cache for offline loading on secure origins. Network-first shell refresh checks for updates while online and caches only a known set of static assets; service-worker activation deletes only older Notebook caches.
- Failed or conflicting saves show an on-screen warning and let users export unsaved notes before reloading; these behaviors require full browser acceptance testing.

## Known risks

- Notes, local import-recovery checkpoints, and exported JSON are **unencrypted plaintext** at the app level. Import is limited to 22 MB, but export currently has no equivalent cap: oversized exports cannot be restored in this preview, and the UI warns on download. Checkpoints consume additional browser storage and are not durable offline backups.
- Anyone with the browser profile/device access may read the notebook.
- Device loss, browser data clearing, private mode and storage eviction can erase local notes.
- Synchronous IndexedDB serialization failures abort the transaction; Chromium tests verified that a failed structured-clone write changes neither stored notes nor the import recovery checkpoint. This does not simulate storage-quota exhaustion or guarantee recovery after device failure.
- Snapshot saves now compare a revision number atomically inside an IndexedDB read/write transaction. A stale tab is blocked instead of silently overwriting a newer snapshot. The app does not merge conflicts, maintain historical revisions, or guarantee recovery of edits lost when the browser closes before export.
- Stable-ID wiki links now survive target renaming; existing title-only links can still break on rename and require migration. Neither link form is a document access-control mechanism.
- Service-worker cache invalidation and upgrade migrations require further device testing.
- No production-ready auth, authorization, audit, backup automation, antivirus, attachment inspection or encryption currently exists.
- A browser app cannot protect against compromised extensions or privileged operating system malware.

## Release blockers

Before deployment or adding sync, execute threat modeling, live-browser tests, backup and recovery tests, cross-tab safety, schema upgrades, accessibility review, GC UI visual acceptance and dependency/security review. Verify GoreeShield data-governance permissions, Wardveil controls and GoreeCloud Identity authentication before any multi-user or remote-data feature.

Vulnerability disclosures must avoid posting secrets, real note content, or exploit details to public issues.

# GoreeCloud Notebook — Security and Privacy

**Development preview, not production security-certified.**

## Existing safety properties

- All notes remain in browser IndexedDB; no backend, analytics or third-party AI endpoint is configured.
- Browser CSP disallows third-party scripts, remote connections, object embeds and uncontrolled form destinations.
- UI output escapes note titles, content and tags before inserting HTML.
- Markdown preview supports a limited set of formatting patterns without enabling arbitrary user HTML.
- Portable JSON imports validate the schema, bounded note bodies, unique IDs and cycle-free hierarchy before overwrite confirmation.
- Remote JavaScript plugins, dynamic execution and public publication are not included.
- The application shell can cache for offline loading on secure origins.
- Failed or conflicting saves show an on-screen warning and let users export unsaved notes before reloading; these behaviors require full browser acceptance testing.

## Known risks

- Notes and exported JSON are **unencrypted plaintext** at the app level.
- Anyone with the browser profile/device access may read the notebook.
- Device loss, browser data clearing, private mode and storage eviction can erase local notes.
- Snapshot saves now compare a revision number atomically inside an IndexedDB read/write transaction. A stale tab is blocked instead of silently overwriting a newer snapshot. The app does not merge conflicts, maintain historical revisions, or guarantee recovery of edits lost when the browser closes before export.
- Note links use titles and can break on rename; they are not secure document access controls.
- Service-worker cache invalidation and upgrade migrations require further device testing.
- No production-ready auth, authorization, audit, backup automation, antivirus, attachment inspection or encryption currently exists.
- A browser app cannot protect against compromised extensions or privileged operating system malware.

## Release blockers

Before deployment or adding sync, execute threat modeling, live-browser tests, backup and recovery tests, cross-tab safety, schema upgrades, accessibility review, GC UI visual acceptance and dependency/security review. Verify GoreeShield data-governance permissions, Wardveil controls and GoreeCloud Identity authentication before any multi-user or remote-data feature.

Vulnerability disclosures must avoid posting secrets, real note content, or exploit details to public issues.

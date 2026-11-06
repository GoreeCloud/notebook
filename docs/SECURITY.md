# GoreeCloud Notebook — Security and Privacy

**Development preview, not production security-certified.**

## Existing safety properties

- All notes remain in browser IndexedDB; no backend, analytics or third-party AI endpoint is configured.
- Browser CSP disallows third-party scripts, remote connections, object embeds and uncontrolled form destinations. The pinned GC UI 1.0.1 CSS is self-hosted, with no external font or CSS request; its upstream Git blob and Apache-2.0 license are verified in the test suite.
- UI output escapes note titles, content and tags before inserting HTML.
- Markdown preview supports a limited set of formatting patterns without enabling arbitrary user HTML.
- Portable plain JSON and standard gzip-compressed JSON imports validate the schema, bounded note bodies, unique IDs and cycle-free hierarchy before overwrite confirmation. Gzip decompression enforces a 64 MB output cap and a 66 MB compressed input cap to limit decompression bombs. Full-workspace replacements also preserve the previous validated snapshot as a one-step local recovery checkpoint in the same IndexedDB transaction.
- Remote JavaScript plugins, dynamic execution and public publication are not included.
- Destructive synthetic browser test fixtures refuse execution unless they run on `http://127.0.0.1` with a fresh, matching nonce injected through the disposable Chromium test runner. Static site visitors cannot activate them with a guessed URL marker. Public deployments should nevertheless exclude `test/` and `scripts/` entirely. See [Browser Test Isolation](TESTING.md).
- A new `build:release` script stages the ten known PWA runtime files, MIT license, verbatim upstream GC UI Apache-2.0 license and attribution notice. CI confirms byte-identical files and the **absence** of destructive `test/` files, developer `scripts/` and documentation from that distribution directory. The local development server now binds to `127.0.0.1` by default. Neither control is a production security certification.
- The application shell can cache for offline loading on secure origins. Network-first shell refresh checks for updates while online and caches only a known set of static assets; service-worker activation deletes only older Notebook caches.
- Failed/conflicting saves show a warning and allow unsaved exports before reload. Browser exit triggers a leave-confirmation request only while notes are unsaved or saving has failed. Targeted Chromium checks passed, but prompts depend on browser behavior and user interaction.

## Known risks

- Notes, local import-recovery checkpoints, JSON, and gzip archives are **unencrypted plaintext** at the app level. Plain JSON import supports up to 22 MB; standard gzip JSON restores up to 64 MB decompressed (and 66 MB compressed input). Larger files may still be exported, but are flagged un-restorable in the preview. Compression is **not encryption**. Checkpoints consume additional browser storage and are not durable off-device backups.
- Anyone with the browser profile/device access may read the notebook.
- Device loss, browser data clearing, private mode and storage eviction can erase local notes. Settings reports an approximate browser-origin storage estimate and provides a user-triggered StorageManager persistence request; browsers may deny it, and grants do not prevent manual clearing or device loss.
- The gzip reader counts decompressed bytes before JSON parsing to limit decompression bombs, but large-file parsing and whole-snapshot storage can still exhaust RAM or browser quotas; the 64 MB cap does not guarantee success on all devices.
- Chromium's experimental DevTools quota override did not produce an IndexedDB quota rejection for 3.6 MB or 27 MB test writes, so actual browser-origin quota exhaustion **remains unverified**. The experimental test is kept outside the required CI gate; see [Testing](TESTING.md).
- Synchronous IndexedDB failures abort the transaction. Chromium tests verified that both a failed structured-clone write and a deliberately simulated synchronous `QuotaExceededError` leave the last saved notes and import recovery checkpoint unchanged, while unsaved draft text remains available for export. This is a synthetic failure test, not verification under actual disk/full-browser-quota exhaustion or device failure.
- Snapshot saves now compare a revision number atomically inside an IndexedDB read/write transaction. A stale tab is blocked instead of silently overwriting a newer snapshot. The app does not merge conflicts, maintain historical revisions, or guarantee recovery of edits lost when the browser closes before export.
- Stable-ID wiki links now survive target renaming; existing title-only links can still break on rename and require migration. Neither link form is a document access-control mechanism.
- Service-worker cache invalidation and upgrade migrations require further device testing.
- No production-ready auth, authorization, audit, backup automation, antivirus, attachment inspection or encryption currently exists.
- A browser app cannot protect against compromised extensions or privileged operating system malware.

## Release blockers

Before deployment or adding sync, execute threat modeling, live-browser tests, backup and recovery tests, cross-tab safety, schema upgrades, accessibility review, GC UI visual acceptance and dependency/security review. Verify GoreeShield data-governance permissions, Wardveil controls and GoreeCloud Identity authentication before any multi-user or remote-data feature.

Vulnerability disclosures must avoid posting secrets, real note content, or exploit details to public issues.

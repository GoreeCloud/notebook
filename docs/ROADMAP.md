# Roadmap and acceptance

## Foundation
- [x] Original backend and React, Qt Quick and Kotlin/Compose source
- [x] Local notes, Markdown, search and revision-aware API
- [x] Initial licensing/provenance and security documentation
- [ ] Verified Android physical-device install and Linux package
- [x] Passing four required GitHub CI checks and enforced protected-main PR flow

## Knowledge features
- [x] Native Android SQLite v3 notebooks, nested notes and explicit plaintext JSON v2 export
- [x] Android native SQL-paginated 160-character note previews with Load More beyond 500 records (synthetic OnePlus N200 instrumentation passed; human paging UX acceptance pending)
- [x] Synthetic Android v1→v3 and v2→v3 physical-device SQLite migration acceptance; real user data untouched
- [x] Android JSON v2 import with safe dry-run, new-ID append and physical-device isolated instrumentation/rollback acceptance
- [x] Linux Qt notebook selector, nested-note creation, tags and disposable smoke verification
- [x] Native Linux pinned-note editing with optimistic version protection and unsaved draft guard (manual accessibility pending)
- [x] Linux Qt user-directed JSON v2 recovery source, preview-before-append and private plaintext export (human file-picker acceptance pending)
- [ ] Complete tree/attachments/tags/revisions and full import/export format parity across all clients
- [x] Validated JSON v1/v2 append-only import, dry-run and basic round-trip tests
- [x] Conservative ENEX text, timestamp and tag importer with DTD/entity refusal and media opt-out tests
- [x] Safe Markdown ZIP import/export of active note trees with path validation, basic round-trip tests and explicit metadata/media-loss acknowledgement
- [ ] Full ENEX/ENML fidelity, attachments and full Trilium-specific ZIP metadata migration
- [ ] Rich text (evaluate MIT Tiptap/ProseMirror), web clipping and OCR
- [x] Indexed local FTS5 title/body/tag search, query sanitization and browser ranked results
- [x] Optional ranked-search summaries for web with selected-note full-body hydration, including SQLite LIKE fallback
- [x] Optional paged local note list API with explicit browser Load More beyond 500 notes (snapshot paging pending)
- [x] Authenticated local wiki-link/backlink graph across the full active corpus with stable note-ID references and bounded pagination
- [x] Android offline wiki-link navigation with stable local ID references, Unicode title disambiguation and unsaved-edit guard (synthetic physical-device parser/SQLite test passed; manual UI acceptance pending)
- [ ] Wiki-link graph performance benchmarks, true full-text corpus search acceptance, keyboard accessibility E2E tests


## Privacy, security and recoverability
- [ ] Identity authorization, GoreeShield consent and retention, Wardveil security integration
- [x] Optional encrypted local SQLite snapshot with Argon2id/AES-GCM and synthetic restoration tests
- [x] Explicit encrypted-archive in-memory verification with no plaintext output file (not an independent off-device restore rehearsal)
- [x] Linux Qt verify-only encrypted archive picker/password flow with synthetic no-write tests (manual dialog acceptance pending)
- [x] Optional native Linux encrypted snapshot export UI (CLI restore only; source venv PyCA, package dependency/AT acceptance pending)
- [x] Read-only local SQLite/file-sidecar mode and ownership audit (operator-run; no automatic changes)
- [ ] Encrypted live note store, protected browser exports, off-device backup and independent restoration rehearsal
- [ ] Versioned schema migrations and safe import quarantine

## Synchronization and release
- [x] Local SQLite note-mutation event cursor with pagination and migration baseline
- [ ] Mesh-owned offline sync with authenticated device cursors and conflict policy
- [ ] Optional Yjs collaboration after security/licensing review
- [ ] Signed APK, native Linux package and verified upgrade/recovery (experimental unsigned .deb builder added; full packaging release gates not met)
- [ ] GoreeCloud Containers deployment when ready, documented Docker/Podman alternatives

Unchecked items are not implemented or not yet independently verified.

## CI reliability follow-up

Android main-push workflow intermittently failed the `packageDebug` task on 2026-11-20 while equivalent pull-request builds passed. `--stacktrace` is now enabled for the Android build so future failures expose the underlying error. No root cause or fix is claimed; GitHub issue tracks further qualification, test-repeatability and clean-run evidence.

## Optional local container preview

- [x] Source-controlled digest-pinned Linux amd64 Podman/Docker Containerfile, loopback-only Compose configuration and disposable synthetic rootless Podman smoke script (production deployment is NOT implemented)
- [ ] Docker Compose provider acceptance, multiarch image, pinned transitive wheel hashes/SBOM scanning, signed publication, production Identity/Mesh/GoreeShield/Wardveil policies and off-device backup

# Roadmap and acceptance

## Foundation
- [x] Original backend and React, Qt Quick and Kotlin/Compose source
- [x] Local notes, Markdown, search and revision-aware API
- [x] Initial licensing/provenance and security documentation
- [ ] Verified Android physical-device install and Linux package
- [ ] Passing GitHub CI and enforced protected-main PR flow

## Knowledge features
- [ ] Complete tree/attachments/tags/revisions parity across all clients
- [x] Validated JSON v1/v2 append-only import, dry-run and basic round-trip tests
- [x] Conservative ENEX text, timestamp and tag importer with DTD/entity refusal and media opt-out tests
- [ ] Full ENEX/ENML fidelity, attachments, Markdown folder and Trilium ZIP import plus round-trip tests
- [ ] Rich text (evaluate MIT Tiptap/ProseMirror), web clipping and OCR
- [ ] Backlink graph, full-text indexing and keyboard accessibility E2E tests

## Privacy, security and recoverability
- [ ] Identity authorization, GoreeShield consent and retention, Wardveil security integration
- [ ] Encrypted note store, protected exports, backup + restoration rehearsal
- [ ] Versioned schema migrations and safe import quarantine

## Synchronization and release
- [x] Local SQLite note-mutation event cursor with pagination and migration baseline
- [ ] Mesh-owned offline sync with authenticated device cursors and conflict policy
- [ ] Optional Yjs collaboration after security/licensing review
- [ ] Signed APK, native Linux packaging and verified upgrade/recovery
- [ ] GoreeCloud Containers deployment when ready, documented Docker/Podman alternatives

Unchecked items are not implemented or not yet independently verified.

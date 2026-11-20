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
- [x] Safe Markdown ZIP import/export of active note trees with path validation, basic round-trip tests and explicit metadata/media-loss acknowledgement
- [ ] Full ENEX/ENML fidelity, attachments and full Trilium-specific ZIP metadata migration
- [ ] Rich text (evaluate MIT Tiptap/ProseMirror), web clipping and OCR
- [x] Indexed local FTS5 title/body/tag search, query sanitization and browser ranked results
- [ ] Backlink graph, full corpus search benchmarks and keyboard accessibility E2E tests

## Privacy, security and recoverability
- [ ] Identity authorization, GoreeShield consent and retention, Wardveil security integration
- [ ] Encrypted note store, protected exports, backup + restoration rehearsal
- [ ] Versioned schema migrations and safe import quarantine

## Synchronization and release
- [x] Local SQLite note-mutation event cursor with pagination and migration baseline
- [ ] Mesh-owned offline sync with authenticated device cursors and conflict policy
- [ ] Optional Yjs collaboration after security/licensing review
- [ ] Signed APK, native Linux package and verified upgrade/recovery (experimental unsigned .deb builder added; full packaging release gates not met)
- [ ] GoreeCloud Containers deployment when ready, documented Docker/Podman alternatives

Unchecked items are not implemented or not yet independently verified.

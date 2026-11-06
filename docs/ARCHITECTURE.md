# GoreeCloud Notebook — Architecture

## v0.1 browser implementation

GoreeCloud Notebook is a static PWA with zero runtime packages and no server dependencies. index.html starts the UI, src/app.js handles DOM state and actions, src/model.js owns pure note operations and validation, and src/storage.js provides a single IndexedDB adapter. The UI tracks in-flight and successfully committed edit generations to request confirmation on browser exit only while saves are pending or failed. Settings can display an approximate browser-origin storage estimate and request persistence in a user gesture; this does not constitute off-device backup. The service worker caches an allowlisted public app shell for offline reopening, updates shell assets through network-first requests while online, and removes only obsolete Notebook cache versions.

## Current data model

Version 1 snapshot comprises version, notes, selectedId and theme, plus a monotonically increasing local revision number (legacy snapshots start at revision zero). Every note has a local ID; title; body; parentId; type; tags; favorite, archived, trashed and completed flags; dueDate; createdAt and updatedAt. Parent pointers create an acyclic rooted forest. Wiki references support stable ID syntax ([[id:note-id]]) and legacy title-based syntax ([[Note title]]); backlinks search both forms. Legacy links may break when titles are renamed. Deletion is soft trash; export copies the full note set including trash.

The current adapter stores one active snapshot under IndexedDB object store `app`, key `snapshot`. An import or undo also atomically copies the replaced snapshot to `pre-import-recovery`, retaining one local recovery checkpoint. Ordinary autosaves do not overwrite that checkpoint, and a subsequent full-workspace replacement swaps the recovery record. Both records are plaintext and subject to the browser's quota and eviction policies. Writes are serialized and debounced. Every write checks the expected revision within the IndexedDB read/write transaction and aborts on a mismatch, preventing silent stale-tab replacement. The UI preserves the in-memory unsaved notes and exposes export/reload choices after a conflict. Import and recovery use the same atomic revision check, so outdated tabs cannot silently replace a newer workspace. Synchronous IndexedDB write exceptions are caught and abort the transaction; the failing storage promise rejects rather than leaving a pending autosave. Chromium DataCloneError and simulated QuotaExceededError regressions verify unchanged active and checkpoint records and rejection of the failing save; the quota simulation is not a real low-disk or storage-eviction test (GitHub Actions runs 42254868875 and 42294300602). This is only optimistic conflict rejection, not multi-tab collaboration, merge, recovery journaling, or synchronization.

## Future transition

1. Split notes, attachments, metadata and revision journals into separate stores with transactional schema migrations.
2. Adopt stable-ID graph relations and content-link integrity tooling.
3. Add audit-tested attachment storage and complete Markdown editor.
4. Implement encrypted workspace mode and verified recovery.
5. Introduce GoreeCloud Identity for user-level access and sessions.
6. Integrate GoreeCloud Mesh only after sync protocol, authorization and conflict tests.
7. Integrate GoreeCloud AI behind explicit GoreeShield consent, note permissions and Wardveil-reviewed tool boundaries.
8. Adopt canonical GC UI tokens/components and test rendered viewports.

## Four pillars and identity

- GoreeShield: privacy policy, consent, sharing preferences and data minimization.
- Wardveil: cybersecurity, authentication security, encryption and risk controls.
- GoreeCloud Mesh: interoperability, data exchange, integration health and synchronization.
- GoreeCloud UI: sole visual and interaction design authority.
- GoreeCloud Identity: separate mandatory identity platform for any future authenticated service.

No integration with those remote systems is active in this build. Architectural references do not establish a deployed connection.

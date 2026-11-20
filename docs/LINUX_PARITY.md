# Native Linux notebook navigation — development preview

The Python/PySide6 Qt Quick 6.12 client remains a **native local SQLite application**; it uses the existing Notebook service `Store` code and the same SQLite schema when configured to the same host file, but it does not initiate a network session, implement GoreeCloud Mesh, or authenticate remote users.

This development-stage update adds:

- An accessible QML notebook selector (all notebooks or an individual notebook) backed by `Store.notebooks()` and `Store.list_notes(notebook_id=...)`.
- Notebook creation with 1–120 character name checks; new notes use the selected notebook.
- Nested child-note creation from an active parent; note list entries indicate when a note belongs to a parent.
- Comma-separated tag editing with a 20-tag and 64-character/tag limit. The legacy `saveNote` bridge slot still preserves existing tags rather than deleting them.
- The existing optimistic-version saving, note history, search, Trash/restore and dirty-draft confirmation remain available. The new notebook switcher and create-notebook actions also use the unsaved-draft guard.

**Migration safety:** No extra Linux schema, destructive migration or new database format is introduced. Existing service SQLite files can continue working without copying or redefining notes. The local Qt bridge remains independently tested against temporary databases. Global/cross-platform identity and sync remain unavailable.

**Smoke-test isolation:** Setting `GC_NOTEBOOK_SMOKE=1` now creates a temporary SQLite database and deletes it when the QML smoke quits. The flag **never opens the user's configured `XDG_DATA_HOME` Notebook database**. Regression tests verify this property with a sentinel empty directory. Normal app startup without the smoke flag continues to use the configured local SQLite path.

**Unresolved:** Fully hierarchical indented tree UX, cross-notebook subtree moves, file attachments, Android/Linux rich text parity, keyboard-only navigation and native screen-reader approval, RTL, responsive/zoom acceptance and signed redistributable Linux packaging. Qt bindings are tested in headless/offscreen CI, not a human-operated desktop accessibility session. This feature does not imply application-wide GoreeCloud UI design compliance, GoreeShield consent enforcement, Wardveil certification or GoreeCloud Identity adoption.

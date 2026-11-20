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

**Package smoke regression:** The Debian extraction smoke script now explicitly asserts that `XDG_DATA_HOME` remains absent after the temporary Qt smoke finishes. This replaces the earlier assertion that an on-disk user-profile database should have been created. The previous assertion failed because the new isolation behavior was working. Source and extracted-package smoke must both avoid user-data writes.

**Portable local recovery:** The Linux sidebar now offers manually chosen JSON v2 export/import with validation, dry-run, confirmation and 0600 exclusive export. See [Linux JSON Recovery](LINUX_JSON_RECOVERY.md); no actual sync or encryption of live storage is implied.

## Local wiki-link navigation — development preview

Qt Quick Linux now displays the first 30 resolved incoming and outgoing
references for a selected active note, based on the local SQLite link graph.
Buttons navigate to the target note, automatically scope its notebook (including
cross-notebook UUID links), clear a conflicting search filter and use the existing
unsaved-draft discard confirmation before navigation. Trash targets and invalid
IDs are refused; no network requests or background scanning are introduced.
The graph refreshes when the selected note or local note collection changes.

Long link lists currently show a truncation indicator rather than an additional
page control. Headless Qt and synthetic bridge tests confirm behavior but do
not establish real-device keyboard/screen-reader accessibility acceptance.

## Large local collections and Trash — development preview

The Qt sidebar requests SQL-paginated **160-character text previews** rather
than transferring every full note body into the list. It loads 500 summaries
initially, exposes an explicit Load 500 more button and caps the in-memory
sidebar view at 5,000 notes with a visible narrowing hint. Opening a note
still fetches its complete Markdown via the existing selected-note path.

Trash is filtered in SQLite **before** page limits; deleted notes beyond the
first 500 active entries are no longer silently hidden. Search and notebook
filters also apply before SQL pagination. Changing the filter, notebook,
Trash mode or following a cross-notebook link resets the page window.
As with the web list, offset pages can move during concurrent writes; no
cross-device snapshot or Mesh synchronization is provided.

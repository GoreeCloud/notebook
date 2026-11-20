# Web plaintext JSON export confirmation — privacy UX

The web Notebook editor must request **explicit confirmation before** fetching a complete JSON export. The warning describes the unencrypted contents: all notebooks, note text (including Trash), tags, and note revisions. It makes clear that the browser/download provider chooses the destination and other users with filesystem access could read this file.

The existing text/Markdown ZIP workflow already warns about plaintext and metadata loss. This change adds comparable consent to the **full JSON** workflow, without altering JSON serialization, API authorization, file contents, destination behavior or note storage.

Imports can refresh the displayed notes; the web client now confirms before starting an import if the current selected note has unsaved changes. Canceling leaves the draft in place and initiates no API import. These safeguards are client-side UI behavior. A user or API client calling the REST endpoint directly must understand its own security and storage responsibilities. No server-side GoreeShield consent policy is implied.

Tests assert the presence and ordering of the UI guards, with a TypeScript/Vite production build. Human keyboard, screen-reader and full browser export/download acceptance remain open; no assertion of a complete privacy audit or encrypted export is made.

## Unsaved draft guard on navigation

The web editor warns before leaving an unsaved note for a newly created
note or notebook, changing notebook/Trash scope, moving to Trash,
restoring a saved revision or disconnecting. Canceling leaves the
draft unchanged and makes no mutation request. Following another note
prompts; selecting the same note does not. This is only a client-side
confirmation: no automatic draft persistence or protection from browser
crashes and no GoreeShield policy enforcement. Save important edits before
switching contexts.

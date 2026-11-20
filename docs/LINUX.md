# Native Linux client — Qt Quick 6.12

This development-preview client edits a local SQLite notebook without a running HTTP service. The Qt Quick interface uses GoreeCloud UI semantic tokens. It supports searching notes, creating and editing Markdown, note version history, restoring prior revisions, trash navigation and restoring soft-deleted notes.

Unsaved edits prompt before navigating to another note, creating a note, opening Trash, or closing the window. A stale version is refused by the shared SQLite store. The app does **not** silently merge conflicting edits. It does not provide attachments, a rich-text editor, packaged installers, mobile synchronization, encrypted local storage or full notebook hierarchy navigation.

## Local verification

```sh
.venv/bin/pip install -r linux/requirements.txt
QT_QPA_PLATFORM=offscreen .venv/bin/python -m unittest discover -s linux/tests -v
QT_QPA_PLATFORM=offscreen GC_NOTEBOOK_SMOKE=1 .venv/bin/python linux/main.py
```

These tests cover a synthetic SQLite store and offscreen Qt startup, **not** visual accessibility, a physical Linux desktop session, packaging or production reliability.

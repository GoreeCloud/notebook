"""Native Qt Quick 6.12 notebook client, operating offline on local SQLite."""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

from PySide6.QtCore import Property, QObject, Signal, Slot, QUrl, QTimer
from PySide6.QtQml import QQmlApplicationEngine
from PySide6.QtGui import QGuiApplication

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))
from notebook.store import Store, Conflict, NotFound


def default_database() -> str:
    base = Path(os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local/share")))
    return str(base / "goreecloud/notebook/notes.sqlite3")


class Bridge(QObject):
    notesChanged = Signal()
    selectedChanged = Signal()
    statusChanged = Signal()
    notebooksChanged = Signal()
    revisionsChanged = Signal()
    trashViewChanged = Signal()

    def __init__(self, database: str):
        super().__init__()
        self.store = Store(database)
        self._query = ""
        self._active_notebook = ""
        self._selected = ""
        self._show_trash = False
        self._status = "All changes stored on this device"

    @Property(str, notify=notesChanged)
    def notesJson(self):
        notes = self.store.list_notes(
            notebook_id=self._active_notebook or None,
            q=self._query,
            include_deleted=self._show_trash,
        )
        if self._show_trash:
            notes = [n for n in notes if n["deleted_at"]]
        return json.dumps(notes)

    @Property(str, notify=notebooksChanged)
    def activeNotebook(self):
        return self._active_notebook

    @Property(str, notify=notebooksChanged)
    def notebooksJson(self):
        return json.dumps(self.store.notebooks())

    @Property(str, notify=selectedChanged)
    def selectedJson(self):
        if not self._selected:
            return "{}"
        try:
            return json.dumps(self.store.get(self._selected, include_deleted=True))
        except NotFound:
            return "{}"

    @Property(bool, notify=trashViewChanged)
    def trashView(self):
        return self._show_trash

    @Property(str, notify=revisionsChanged)
    def revisionsJson(self):
        if not self._selected:
            return "[]"
        try:
            return json.dumps(self.store.revisions(self._selected))
        except NotFound:
            return "[]"

    @Property(str, notify=statusChanged)
    def status(self):
        return self._status

    def _message(self, status):
        self._status = status
        self.statusChanged.emit()

    @Slot(str)
    def setQuery(self, query):
        self._query = query[:200]
        self.notesChanged.emit()

    @Slot(str)
    def setNotebook(self, notebook_id):
        if notebook_id:
            if not any(book["id"] == notebook_id for book in self.store.notebooks()):
                self._message("Notebook does not exist")
                return
        self._active_notebook = notebook_id
        self._selected = ""
        self.notebooksChanged.emit()
        self.selectedChanged.emit()
        self.revisionsChanged.emit()
        self.notesChanged.emit()

    @Slot(str)
    def newNotebook(self, name):
        clean = name.strip()
        if not clean or len(clean) > 120:
            self._message("Notebook name must contain 1–120 characters")
            return
        try:
            book = self.store.create_notebook(clean)
            self.setNotebook(book["id"])
            self.notebooksChanged.emit()
            self._message("Notebook created")
        except (Conflict, NotFound, ValueError) as ex:
            self._message(str(ex))

    @Slot(str)
    def newChildNote(self, parent_id):
        try:
            parent = self.store.get(parent_id)
            if parent["deleted_at"]:
                self._message("Restore parent before adding child notes")
                return
            note = self.store.create(parent["notebook_id"], "Untitled note", parent_id=parent_id)
            self._active_notebook = parent["notebook_id"]
            self._selected = note["id"]
            self.notebooksChanged.emit()
            self.notesChanged.emit()
            self.selectedChanged.emit()
            self.revisionsChanged.emit()
            self._message("Nested note created")
        except (Conflict, NotFound) as ex:
            self._message(str(ex))

    @Slot(str)
    def selectNote(self, note_id):
        self._selected = note_id
        self.selectedChanged.emit()
        self.revisionsChanged.emit()

    @Slot(bool)
    def setTrashView(self, enabled):
        self._show_trash = enabled
        self._selected = ""
        self.selectedChanged.emit()
        self.revisionsChanged.emit()
        self.notesChanged.emit()
        self.trashViewChanged.emit()

    @Slot()
    def newNote(self):
        try:
            notebook_id = self._active_notebook or self.store.notebooks()[0]["id"]
            note = self.store.create(notebook_id, "Untitled note")
            self._selected = note["id"]
            self.notesChanged.emit()
            self.selectedChanged.emit()
            self.revisionsChanged.emit()
            self._message("New note created")
        except (Conflict, NotFound, IndexError) as ex:
            self._message(str(ex))

    @Slot(str, str, str, int)
    def saveNote(self, note_id, title, body, version):
        # Backwards-compatible slot retained for older QML clients/tests;
        # never silently discard an existing note's tags.
        try:
            existing = self.store.get(note_id, include_deleted=True)
        except NotFound as ex:
            self._message(str(ex))
            return
        return self.saveNoteWithTags(
            note_id, title, body, ", ".join(existing["tags"]), version
        )

    @Slot(str, str, str, str, int)
    def saveNoteWithTags(self, note_id, title, body, tags_text, version):
        if len(title) > 200 or len(body) > 1_000_000 or len(tags_text) > 500:
            self._message("Title, body or tags exceed Notebook's local size limits")
            return
        tags = [tag.strip() for tag in tags_text.split(",") if tag.strip()]
        if len(tags) > 20 or any(len(tag) > 64 for tag in tags):
            self._message("Tags must have at most 20 nonempty entries of 64 characters each")
            return

        try:
            self.store.update(
                note_id,
                {"title": title.strip() or "Untitled note", "body": body,
                 "tags": tags},
                version,
            )
            self.notesChanged.emit()
            self.selectedChanged.emit()
            self.revisionsChanged.emit()
            self._message("Saved")
        except (Conflict, NotFound) as ex:
            self._message(str(ex) + " — reload before overwriting")

    @Slot(str, int)
    def deleteNote(self, note_id, version):
        try:
            from notebook.store import now
            self.store.update(note_id, {"deleted_at": now()}, version)
            self._selected = ""
            self.selectedChanged.emit()
            self.notesChanged.emit()
            self.revisionsChanged.emit()
            self._message("Moved to Trash")
        except (Conflict, NotFound) as ex:
            self._message(str(ex))


    @Slot(str, int)
    def restoreNote(self, note_id, version):
        try:
            self.store.update(note_id, {"deleted_at": None}, version)
            self._selected = ""
            self.selectedChanged.emit()
            self.revisionsChanged.emit()
            self.notesChanged.emit()
            self._message("Restored from Trash")
        except (Conflict, NotFound) as ex:
            self._message(str(ex))

    @Slot(str, int, int)
    def restoreRevision(self, note_id, revision, current_version):
        try:
            self.store.restore_revision(note_id, revision, current_version)
            self.notesChanged.emit()
            self.selectedChanged.emit()
            self.revisionsChanged.emit()
            self._message("Revision restored")
        except (Conflict, NotFound) as ex:
            self._message(str(ex))


def main():
    app = QGuiApplication(sys.argv)
    app.setApplicationName("GoreeCloud Notebook")
    engine = QQmlApplicationEngine()
    # The UI smoke flag must NEVER touch the user's normal Notebook database.
    # Disposable synthetic storage also allows CI runs without secrets.
    smoke = os.environ.get("GC_NOTEBOOK_SMOKE") == "1"
    sandbox = tempfile.TemporaryDirectory(prefix="goreecloud-notebook-qt-smoke-") if smoke else None
    try:
        path_to_db = str(Path(sandbox.name) / "notes.sqlite3") if sandbox else default_database()
        bridge = Bridge(path_to_db)
        engine.rootContext().setContextProperty("backend", bridge)
        path = Path(__file__).parent / "qml/Main.qml"
        engine.load(QUrl.fromLocalFile(str(path.resolve())))
        if not engine.rootObjects():
            return 1
        if smoke:
            QTimer.singleShot(150, app.quit)
        return app.exec()
    finally:
        if sandbox is not None:
            sandbox.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())

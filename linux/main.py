"""Native Qt Quick 6.12 notebook client, operating offline on local SQLite."""
from __future__ import annotations

import json
import os
import sys
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

    def __init__(self, database: str):
        super().__init__()
        self.store = Store(database)
        self._query = ""
        self._selected = ""
        self._status = "All changes stored on this device"

    @Property(str, notify=notesChanged)
    def notesJson(self):
        return json.dumps(self.store.list_notes(q=self._query))

    @Property(str, notify=notebooksChanged)
    def notebooksJson(self):
        return json.dumps(self.store.notebooks())

    @Property(str, notify=selectedChanged)
    def selectedJson(self):
        if not self._selected:
            return "{}"
        try:
            return json.dumps(self.store.get(self._selected))
        except NotFound:
            return "{}"

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
    def selectNote(self, note_id):
        self._selected = note_id
        self.selectedChanged.emit()

    @Slot()
    def newNote(self):
        try:
            notebook_id = self.store.notebooks()[0]["id"]
            note = self.store.create(notebook_id, "Untitled note")
            self._selected = note["id"]
            self.notesChanged.emit()
            self.selectedChanged.emit()
            self._message("New note created")
        except (Conflict, NotFound, IndexError) as ex:
            self._message(str(ex))

    @Slot(str, str, str, int)
    def saveNote(self, note_id, title, body, version):
        try:
            self.store.update(note_id, {"title": title.strip() or "Untitled note", "body": body}, version)
            self.notesChanged.emit()
            self.selectedChanged.emit()
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
            self._message("Moved to Trash (recovery available through API)")
        except (Conflict, NotFound) as ex:
            self._message(str(ex))


def main():
    app = QGuiApplication(sys.argv)
    app.setApplicationName("GoreeCloud Notebook")
    engine = QQmlApplicationEngine()
    bridge = Bridge(default_database())
    engine.rootContext().setContextProperty("backend", bridge)
    path = Path(__file__).parent / "qml/Main.qml"
    engine.load(QUrl.fromLocalFile(str(path.resolve())))
    if not engine.rootObjects():
        return 1
    if os.environ.get("GC_NOTEBOOK_SMOKE") == "1":
        QTimer.singleShot(150, app.quit)
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())

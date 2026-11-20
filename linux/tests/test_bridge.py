"""Native Qt/Python bridge smoke tests with an isolated temporary database."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "linux"))
from main import Bridge


class LinuxBridgeTest(unittest.TestCase):
    def test_revisions_and_trash(self):
        with tempfile.TemporaryDirectory() as directory:
            bridge = Bridge(str(Path(directory) / "notes.sqlite3"))
            bridge.newNote()
            item = json.loads(bridge.selectedJson)
            self.assertEqual(item["title"], "Untitled note")
            bridge.saveNote(item["id"], "Edited", "First version", 1)
            changed = json.loads(bridge.selectedJson)
            self.assertEqual(changed["version"], 2)
            revisions = json.loads(bridge.revisionsJson)
            self.assertEqual(revisions[0]["title"], "Untitled note")
            bridge.restoreRevision(item["id"], 1, 2)
            restored = json.loads(bridge.selectedJson)
            self.assertEqual(restored["version"], 3)
            bridge.deleteNote(item["id"], 3)
            self.assertEqual(json.loads(bridge.selectedJson), {})
            bridge.setTrashView(True)
            trashed = json.loads(bridge.notesJson)
            self.assertEqual(len(trashed), 1)
            bridge.selectNote(item["id"])
            self.assertTrue(json.loads(bridge.selectedJson)["deleted_at"])
            bridge.restoreNote(item["id"], 4)
            bridge.setTrashView(False)
            self.assertEqual(len(json.loads(bridge.notesJson)), 1)

    def test_notebook_filter_nested_notes_and_tags(self):
        with tempfile.TemporaryDirectory() as directory:
            bridge = Bridge(str(Path(directory) / "notes.sqlite3"))
            original_book = bridge.store.notebooks()[0]["id"]
            bridge.newNotebook("Projects")
            books = json.loads(bridge.notebooksJson)
            self.assertEqual(len(books), 2)
            self.assertEqual(bridge.activeNotebook, next(b["id"] for b in books if b["name"] == "Projects"))
            bridge.newNote()
            parent = json.loads(bridge.selectedJson)
            self.assertEqual(parent["notebook_id"], bridge.activeNotebook)
            bridge.saveNoteWithTags(parent["id"], "Parent", "Notes and action items",
                                    "project, action", 1)
            edited = json.loads(bridge.selectedJson)
            self.assertEqual(edited["version"], 2)
            self.assertEqual(edited["tags"], ["project", "action"])
            bridge.newChildNote(edited["id"])
            child = json.loads(bridge.selectedJson)
            self.assertEqual(child["parent_id"], edited["id"])
            self.assertEqual(child["notebook_id"], bridge.activeNotebook)
            self.assertEqual(len(json.loads(bridge.notesJson)), 2)
            bridge.setNotebook(original_book)
            self.assertEqual(json.loads(bridge.notesJson), [])
            bridge.setNotebook(child["notebook_id"])
            bridge.selectNote(parent["id"])
            bridge.saveNote(parent["id"], "Renamed", "Still here", 2)
            updated = json.loads(bridge.selectedJson)
            self.assertEqual(updated["version"], 3)
            self.assertEqual(updated["tags"], ["project", "action"],
                             "Legacy save slot must never erase previously saved tags")
            bridge.saveNoteWithTags(parent["id"], "Bad tags", "",
                                    "a" * 65, 3)
            self.assertEqual(json.loads(bridge.selectedJson)["version"], 3)
            bridge.saveNoteWithTags(parent["id"], "Bad" * 100, "", "valid", 3)
            self.assertEqual(json.loads(bridge.selectedJson)["version"], 3)
            bridge.newNotebook(" ")
            self.assertEqual(len(json.loads(bridge.notebooksJson)), 2)
            bridge.setNotebook("not-a-real-notebook")
            self.assertEqual(bridge.activeNotebook, child["notebook_id"])
            bridge.setNotebook("")
            self.assertEqual(len(json.loads(bridge.notesJson)), 2)

    def test_smoke_uses_only_ephemeral_database(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "normal-user-database"
            env = os.environ.copy()
            env.update({"XDG_DATA_HOME": str(target), "GC_NOTEBOOK_SMOKE": "1",
                        "QT_QPA_PLATFORM": "offscreen"})
            run = subprocess.run(
                [sys.executable, str(ROOT / "linux/main.py")],
                env=env, cwd=str(ROOT), text=True, capture_output=True,
                timeout=20,
            )
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertFalse(target.exists(),
                             "Qt smoke must not create the user's normal Notebook database")

    def test_search(self):
        with tempfile.TemporaryDirectory() as directory:
            bridge = Bridge(str(Path(directory) / "notes.sqlite3"))
            bridge.newNote()
            item = json.loads(bridge.selectedJson)
            bridge.saveNote(item["id"], "Searchable", "An offline notebook", 1)
            bridge.setQuery("offline")
            self.assertEqual(len(json.loads(bridge.notesJson)), 1)
            bridge.setQuery("unmatched")
            self.assertEqual(json.loads(bridge.notesJson), [])


if __name__ == "__main__":
    unittest.main()

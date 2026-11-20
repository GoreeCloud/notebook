"""Native Qt/Python bridge smoke tests with an isolated temporary database."""
from __future__ import annotations

import json
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

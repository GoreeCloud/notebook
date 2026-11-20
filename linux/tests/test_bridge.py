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

    def test_local_wiki_links_navigation_cross_notebook_and_trash(self):
        with tempfile.TemporaryDirectory() as directory:
            bridge = Bridge(str(Path(directory) / "notes.sqlite3"))
            first_book = bridge.store.notebooks()[0]["id"]
            destination = bridge.store.create(first_book, "Target", "Original")
            second_book = bridge.store.create_notebook("Second")["id"]
            source = bridge.store.create(
                second_book, "Source", "[[note:" + destination["id"] + "|Target]]"
            )
            link_notifications = []
            bridge.linksChanged.connect(lambda: link_notifications.append(True))
            bridge.setNotebook(second_book)
            bridge.selectNote(source["id"])
            outgoing = json.loads(bridge.linksJson)["outgoing"]["results"]
            self.assertEqual([n["id"] for n in outgoing], [destination["id"]])
            bridge.setQuery("missing")
            self.assertEqual(json.loads(bridge.notesJson), [])
            bridge.navigateLinkedNote(destination["id"])
            self.assertEqual(bridge.activeNotebook, first_book)
            self.assertEqual(json.loads(bridge.selectedJson)["id"], destination["id"])
            self.assertEqual([x["id"] for x in json.loads(bridge.notesJson)],
                             [destination["id"]])
            incoming = json.loads(bridge.linksJson)["incoming"]["results"]
            self.assertEqual([n["id"] for n in incoming], [source["id"]])
            self.assertGreater(len(link_notifications), 0)
            bridge.navigateLinkedNote("not-a-note")
            self.assertEqual(json.loads(bridge.selectedJson)["id"], destination["id"])
            bridge.store.update(source["id"], {"deleted_at": "2026-11-20T00:00:00Z"}, 1)
            self.assertEqual(json.loads(bridge.linksJson)["incoming"]["results"], [])
            bridge.setTrashView(True)
            self.assertEqual(json.loads(bridge.linksJson)["outgoing"]["results"], [])
            self.assertEqual(json.loads(bridge.linksJson)["incoming"]["results"], [])

    def test_qml_link_navigation_uses_unsaved_draft_guard(self):
        qml = (ROOT / "linux/qml/Main.qml").read_text()
        self.assertIn('window.runAction("linked", modelData.id)', qml)
        self.assertIn('else if (action === "linked")', qml)
        self.assertIn('if (hasEdits)', qml)
        self.assertIn('backend.navigateLinkedNote(noteId)', qml)

    def test_paged_sidebar_summaries_and_trash_beyond_active_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            bridge = Bridge(str(Path(directory) / "notes.sqlite3"))
            book = bridge.store.notebooks()[0]["id"]
            with bridge.store.connection() as db:
                for i in range(535):
                    db.execute(
                        """INSERT INTO notes
                        (id,notebook_id,title,body,tags,created_at,updated_at)
                        VALUES (?,?,?,?,?,?,?)""",
                        (f"list-{i:04}", book, f"Note {i:04}", "private" * 100,
                         "[]", "2026-11-20T00:00:00Z",
                         "2026-11-20T00:00:00Z"),
                    )
                db.execute(
                    """INSERT INTO notes (id,notebook_id,title,body,tags,deleted_at,
                    created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)""",
                    ("deep-trash", book, "Old Trash", "not exported in sidebar",
                     "[]", "2026-11-20T00:00:00Z", "2026-11-20T00:00:00Z",
                     "2026-11-20T00:00:00Z"),
                )
            first = json.loads(bridge.notesPageJson)
            self.assertEqual(len(first["results"]), 500)
            self.assertTrue(first["has_more"])
            self.assertNotIn("body", first["results"][0])
            self.assertTrue(all(len(r["preview"]) <= 160 for r in first["results"]))
            bridge.loadMoreNotes()
            second = json.loads(bridge.notesPageJson)
            self.assertEqual(len(second["results"]), 535)
            self.assertFalse(second["has_more"])
            self.assertEqual(len({r["id"] for r in second["results"]}), 535)
            bridge.setTrashView(True)
            trash = json.loads(bridge.notesPageJson)
            self.assertEqual([r["id"] for r in trash["results"]], ["deep-trash"])
            self.assertFalse(trash["has_more"])
            bridge.setTrashView(False)
            self.assertEqual(len(json.loads(bridge.notesPageJson)["results"]), 500)
            bridge.setQuery("Note 0534")
            self.assertEqual(len(json.loads(bridge.notesPageJson)["results"]), 1)

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

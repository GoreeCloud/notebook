"""Offline, synthetic Qt/Linux portable JSON recovery security tests."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PySide6.QtCore import QUrl

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"linux"))
sys.path.insert(0,str(ROOT/"server"))

from main import Bridge
from recovery import MAX_BYTES, PortableJsonError, PortableJsonRecovery
from notebook.store import Store


class LinuxRecoveryTest(unittest.TestCase):
    def test_json_v2_preview_import_and_private_export_preserve_tree_revisions(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            source=Store(str(root/"source.sqlite3"))
            book=source.notebooks()[0]["id"]
            parent=source.create(book,"Parent","Sensitive but synthetic",tags=["parent"])
            child=source.create(book,"Child","Nested",parent_id=parent["id"],tags=["child"])
            modified=source.update(child["id"],{"title":"Child updated","pinned":True},1)
            self.assertEqual(modified["version"],2)
            first=Bridge(str(root/"destination.sqlite3"))
            preexisting=first.store.create(first.store.notebooks()[0]["id"],"Keep me")
            exported=root/"snapshot.json"
            archive=PortableJsonRecovery()
            count=archive.export(source,exported)
            self.assertGreater(count,0)
            self.assertEqual(exported.stat().st_mode & 0o777,0o600)
            doc=json.loads(exported.read_text())
            self.assertEqual(doc["format"],"goreecloud-notebook-v2")
            self.assertEqual(len(doc["revisions"]),1)
            url=QUrl.fromLocalFile(str(exported)).toString()
            report=json.loads(first.previewJsonImport(url))
            self.assertTrue(report["dry_run"])
            self.assertEqual((report["notebooks"],report["notes"],report["revisions"]),(1,2,1))
            self.assertEqual(len(first.store.list_notes()),1)
            self.assertTrue(first.applyJsonImport())
            self.assertEqual(len(first.store.list_notes()),3)
            self.assertEqual(first.store.get(preexisting["id"])["title"],"Keep me")
            imported=[n for n in first.store.list_notes() if n["title"]=="Child updated"][0]
            new_parent=first.store.get(imported["parent_id"])
            self.assertEqual(new_parent["title"],"Parent")
            self.assertNotEqual(new_parent["id"],parent["id"])
            self.assertEqual(first.store.revisions(imported["id"])[0]["title"],"Child")
            self.assertEqual(first.activeNotebook,"")
            self.assertEqual(first.status,"Imported 2 notes into new notebooks")
            self.assertFalse(first.applyJsonImport(),"Second confirmation must be refused")

    def test_preview_is_cached_not_re_read_and_cancellation_clears_it(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            source=Store(str(root/"source.sqlite3"))
            source.create(source.notebooks()[0]["id"],"Previously approved")
            archive=root/"import.json"
            PortableJsonRecovery().export(source,archive)
            dest=Store(str(root/"dest.sqlite3"))
            recovery=PortableJsonRecovery()
            recovery.preview(dest,archive)
            archive.write_text('{"format":"garbage"}')
            result=recovery.apply(dest)
            self.assertEqual(result["notes"],1)
            self.assertEqual(dest.list_notes()[0]["title"],"Previously approved")
            with self.assertRaises(PortableJsonError):
                recovery.apply(dest)
            archive.write_text("not json")
            with self.assertRaises(PortableJsonError):
                recovery.preview(dest,archive)
            self.assertIsNone(recovery._pending)

    def test_refuses_symlinks_oversize_invalid_source_and_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            store=Store(str(root/"source.sqlite3"))
            recovery=PortableJsonRecovery()
            invalid=root/"invalid.json"
            invalid.write_text("not json")
            with self.assertRaises(PortableJsonError):
                recovery.preview(store,invalid)
            invalid.write_bytes(b"\xff")
            with self.assertRaises(PortableJsonError):
                recovery.preview(store,invalid)
            invalid.write_bytes(b"\0"*(MAX_BYTES+1))
            with self.assertRaises(PortableJsonError):
                recovery.preview(store,invalid)
            link=root/"symlink.json"
            link.symlink_to(invalid)
            with self.assertRaises(OSError):
                recovery.preview(store,link)
            output=root/"protected.json"
            output.write_text("existing content must never be overwritten")
            with self.assertRaises(FileExistsError):
                recovery.export(store,output)
            self.assertEqual(output.read_text(),"existing content must never be overwritten")
            with patch("recovery.export_all",return_value={"large":"x"*(MAX_BYTES+1)}):
                with self.assertRaises(PortableJsonError):
                    recovery.export(store,root/"oversize.json")
            self.assertFalse((root/"oversize.json").exists())

    def test_bridge_rejects_remote_urls_and_preview_can_be_canceled(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            source=Store(str(root/"source.sqlite3"))
            source.create(source.notebooks()[0]["id"],"Import me")
            archive=root/"import.json"
            PortableJsonRecovery().export(source,archive)
            bridge=Bridge(str(root/"target.sqlite3"))
            self.assertEqual(bridge.previewJsonImport("https://remote.example.invalid/notes.json"),"")
            self.assertIn("refused",bridge.status)
            self.assertEqual(bridge.previewJsonImport(QUrl.fromLocalFile(str(archive)).toString())!="",True)
            bridge.cancelJsonImport()
            self.assertFalse(bridge.applyJsonImport())
            self.assertEqual(bridge.store.list_notes(),[])
            out=root/"written.json"
            self.assertTrue(bridge.exportJsonFile(QUrl.fromLocalFile(str(out)).toString()))
            self.assertEqual(out.stat().st_mode & 0o777,0o600)
            self.assertFalse(bridge.exportJsonFile(QUrl.fromLocalFile(str(out)).toString()))
            self.assertFalse(bridge.exportJsonFile("https://remote.example.invalid/file.json"))


if __name__=="__main__":
    unittest.main()

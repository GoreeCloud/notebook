"""Opt-in Linux encrypted SQLite export on a synthetic temporary database."""
from __future__ import annotations

import json
import stat
import sys
import tempfile
import unittest
from pathlib import Path

from PySide6.QtCore import QUrl

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"linux"))
sys.path.insert(0,str(ROOT/"server"))
from main import Bridge
from notebook.encrypted_backup import MAGIC, decrypt_backup
from notebook.store import Store

PASSPHRASE="synthetic twelve good words here"


class LinuxEncryptedRecoveryTest(unittest.TestCase):
    def test_optional_encrypted_export_refuses_overwrite_and_preserves_history(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory)
            bridge=Bridge(str(folder/"source.sqlite3"))
            self.assertTrue(bridge.encryptedBackupAvailable)
            bridge.newNote()
            before=bridge.store.get(json.loads(bridge.selectedJson)["id"])
            bridge.saveNote(before["id"],"Private note","private historical body",1)
            encrypted=folder/"notes.gcnb"
            self.assertTrue(bridge.exportEncryptedBackup(
                QUrl.fromLocalFile(str(encrypted)).toString(),PASSPHRASE))
            self.assertEqual(stat.S_IMODE(encrypted.stat().st_mode),0o600)
            payload=encrypted.read_bytes()
            self.assertTrue(payload.startswith(MAGIC))
            self.assertNotIn(b"private historical body",payload)
            self.assertNotIn(PASSPHRASE.encode(),payload)
            self.assertNotIn(PASSPHRASE,bridge.status)
            self.assertFalse(bridge.exportEncryptedBackup(
                QUrl.fromLocalFile(str(encrypted)).toString(),PASSPHRASE))
            self.assertEqual(encrypted.read_bytes(),payload)
            self.assertFalse(bridge.exportEncryptedBackup(
                "https://external.example.com/backup.gcnb",PASSPHRASE))
            self.assertFalse(bridge.exportEncryptedBackup(
                QUrl.fromLocalFile(str(folder/"short.gcnb")).toString(),"short"))
            self.assertFalse((folder/"short.gcnb").exists())
            restored=folder/"restored.sqlite3"
            details=decrypt_backup(encrypted,restored,PASSPHRASE)
            self.assertEqual(details["notes"],1)
            recovered=Store(str(restored))
            current=recovered.get(before["id"])
            self.assertEqual(current["body"],"private historical body")
            self.assertEqual(recovered.revisions(before["id"])[0]["body"],"")

    def test_verify_existing_encrypted_archive_does_not_create_restore(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory)
            bridge=Bridge(str(folder/"source.sqlite3"))
            bridge.newNote()
            note=bridge.store.get(json.loads(bridge.selectedJson)["id"])
            bridge.saveNote(note["id"],"Archive to validate","TOP-SECRET-SYNTHETIC",1)
            archive=folder/"archive.gcnb"
            local=QUrl.fromLocalFile(str(archive)).toString()
            self.assertTrue(bridge.exportEncryptedBackup(local,PASSPHRASE))
            before={x.name:x.read_bytes() for x in folder.iterdir() if x.is_file()}
            self.assertTrue(bridge.verifyEncryptedBackup(local,PASSPHRASE))
            self.assertIn("VALID",bridge.status)
            self.assertIn("no plaintext output",bridge.status)
            self.assertFalse(bridge.verifyEncryptedBackup(local,"incorrect long passphrase"))
            self.assertNotIn(PASSPHRASE,bridge.status)
            self.assertFalse(bridge.verifyEncryptedBackup("https://example.test/a.gcnb",PASSPHRASE))
            self.assertEqual(before,{x.name:x.read_bytes() for x in folder.iterdir() if x.is_file()})
            archive_bytes=bytearray(archive.read_bytes())
            archive_bytes[-1]^=1
            tampered=folder/"tampered.gcnb"
            tampered.write_bytes(archive_bytes)
            self.assertFalse(bridge.verifyEncryptedBackup(
                QUrl.fromLocalFile(str(tampered)).toString(),PASSPHRASE))
            self.assertFalse((folder/"restored.sqlite3").exists())

    def test_qml_consent_and_clear_password_fields(self):
        qml=(ROOT/"linux/qml/Main.qml").read_text(encoding="utf-8")
        self.assertIn('window.runAction("encryptedBackup", "")',qml)
        self.assertIn("backend.encryptedBackupAvailable",qml)
        self.assertIn("echoMode: TextInput.Password",qml)
        self.assertIn('encryptedBackupSecret.text = ""',qml)
        self.assertIn('backend.exportEncryptedBackup(selectedFile.toString(), passphrase)',qml)
        self.assertIn('backend.verifyEncryptedBackup(localFile, passphrase)',qml)
        self.assertIn('encryptedBackupVerifySecret.text = ""',qml)
        self.assertIn('fileMode: PlatformDialogs.FileDialog.OpenFile',qml)
        self.assertIn("It does not replace a separate recovery drill.",qml)


if __name__=="__main__":
    unittest.main()

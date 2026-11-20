import os
import sqlite3
import stat

import pytest

from notebook.backup import SnapshotError, verify
from notebook.encrypted_backup import decrypt_backup, encrypt_backup, MAGIC
from notebook.store import Store

SECRET="battery horse staple river winter cirrus sunshine"


def test_encrypted_backup_restores_live_wal_notes_and_revisions(tmp_path):
    original=tmp_path/"source.sqlite3"
    db=Store(str(original))
    with sqlite3.connect(original) as con:
        con.execute("PRAGMA journal_mode=WAL")
    book=db.notebooks()[0]["id"]
    note=db.create(book,"Private field notes","needle-CANARY-123")
    db.update(note["id"],{"body":"new private state"},1)
    backup=tmp_path/"backup.gcnb"
    summary=encrypt_backup(original,backup,SECRET)
    assert summary["encrypted"]
    assert stat.S_IMODE(backup.stat().st_mode)==0o600
    raw=backup.read_bytes()
    assert raw.startswith(MAGIC)
    assert b"needle-CANARY-123" not in raw
    assert b"new private state" not in raw
    assert sorted(p.name for p in tmp_path.iterdir() if p.suffix==".tmp")==[]
    dest=tmp_path/"restored.sqlite3"
    restored=decrypt_backup(backup,dest,SECRET)
    assert restored["notes"]==1
    assert stat.S_IMODE(dest.stat().st_mode)==0o600
    assert verify(dest)["notes"]==1
    restored_store=Store(str(dest))
    assert restored_store.get(note["id"])["body"]=="new private state"
    assert restored_store.revisions(note["id"])[0]["body"]=="needle-CANARY-123"


def test_wrong_password_tamper_and_truncation_fail_without_writing(tmp_path):
    source=tmp_path/"source.sqlite3"
    Store(str(source))
    encrypted=tmp_path/"snapshot.gcnb"
    encrypt_backup(source,encrypted,SECRET)
    target=tmp_path/"no-output.sqlite3"
    with pytest.raises(SnapshotError,match="passphrase or.*authentication"):
        decrypt_backup(encrypted,target,"different long password 1234")
    assert not target.exists()
    raw=bytearray(encrypted.read_bytes())
    raw[-5]^=1
    corrupted=tmp_path/"tampered.gcnb"
    corrupted.write_bytes(raw)
    with pytest.raises(SnapshotError,match="authentication"):
        decrypt_backup(corrupted,target,SECRET)
    assert not target.exists()
    truncated=tmp_path/"short.gcnb"
    truncated.write_bytes(bytes(raw[:12]))
    with pytest.raises(SnapshotError,match="format"):
        decrypt_backup(truncated,target,SECRET)
    assert not target.exists()


def test_existing_destination_no_overwrite_and_reject_short_password(tmp_path):
    source=tmp_path/"source.sqlite3"
    Store(str(source))
    encrypted=tmp_path/"snapshot.gcnb"
    existing=tmp_path/"existing.gcnb"
    existing.write_bytes(b"DO NOT TOUCH")
    with pytest.raises(SnapshotError,match="exists"):
        encrypt_backup(source,existing,SECRET)
    assert existing.read_bytes()==b"DO NOT TOUCH"
    with pytest.raises(SnapshotError,match="16"):
        encrypt_backup(source,encrypted,"short")
    assert not encrypted.exists()
    encrypt_backup(source,encrypted,SECRET)
    plain=tmp_path/"target.sqlite3"
    plain.write_bytes(b"preserve me")
    with pytest.raises(SnapshotError,match="exists"):
        decrypt_backup(encrypted,plain,SECRET)
    assert plain.read_bytes()==b"preserve me"


def test_symlinked_source_rejected(tmp_path):
    real=tmp_path/"source.sqlite3"
    Store(str(real))
    linked=tmp_path/"source-link.sqlite3"
    linked.symlink_to(real)
    with pytest.raises(SnapshotError,match="symlink"):
        encrypt_backup(linked,tmp_path/"out.gcnb",SECRET)

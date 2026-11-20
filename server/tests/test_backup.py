from pathlib import Path
import os
import sqlite3
import stat

import pytest

from notebook.backup import SnapshotError, snapshot, verify
from notebook.store import Store


def test_snapshot_restore_revisions_and_private_permissions(tmp_path):
    source=tmp_path/"source.sqlite3"
    db=Store(str(source))
    notebook=db.notebooks()[0]["id"]
    created=db.create(notebook,"Private note",body="v1",tags=["important"])
    db.update(created["id"],{"body":"v2"},1)
    backup=tmp_path/"snapshot.sqlite3"
    result=snapshot(source,backup)
    assert result["notes"]==1
    assert stat.S_IMODE(backup.stat().st_mode)==(stat.S_IRUSR|stat.S_IWUSR)
    assert Store(str(backup)).get(created["id"])["body"]=="v2"
    assert len(Store(str(backup)).revisions(created["id"]))==1
    restored=tmp_path/"restored.sqlite3"
    snapshot(backup,restored)
    assert Store(str(restored)).get(created["id"])["tags"]==["important"]


def test_no_overwrite_and_reject_non_notebook(tmp_path):
    src=tmp_path/"source.sqlite3"
    Store(str(src))
    dest=tmp_path/"dest.sqlite3"
    dest.write_bytes(b"do not touch")
    with pytest.raises(SnapshotError,match="already exists"):
        snapshot(src,dest)
    assert dest.read_bytes()==b"do not touch"
    corrupt=tmp_path/"corrupt.sqlite3"
    corrupt.write_bytes(b"not-sqlite!")
    with pytest.raises(SnapshotError):
        verify(corrupt)
    with pytest.raises(SnapshotError):
        snapshot(corrupt,tmp_path/"bad-backup.sqlite3")
    assert not (tmp_path/"bad-backup.sqlite3").exists()


def test_backup_in_wal_mode(tmp_path):
    src=tmp_path/"active.sqlite3"
    store=Store(str(src))
    with sqlite3.connect(src) as conn:
        assert conn.execute("PRAGMA journal_mode=WAL").fetchone()[0]=="wal"
    notebook=store.notebooks()[0]["id"]
    store.create(notebook,"Saved during WAL","stable content")
    dst=tmp_path/"wal-snapshot.sqlite3"
    snapshot(src,dst)
    assert verify(dst)["notes"]==1
    assert Store(str(dst)).list_notes()[0]["body"]=="stable content"

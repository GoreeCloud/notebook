"""Isolated synthetic filesystem tests; never inspect a real notebook database."""
import os
from pathlib import Path
import stat

from notebook.permissions_audit import audit, main


def test_secure_directory_database_and_optional_sidecars(tmp_path):
    folder=tmp_path/"private"
    folder.mkdir(mode=0o700)
    folder.chmod(0o700)
    db=folder/"notes.sqlite3"
    db.write_bytes(b"synthetic-not-a-db")
    db.chmod(0o600)
    wal=folder/"notes.sqlite3-wal"
    wal.write_bytes(b"synthetic-wal")
    wal.chmod(0o600)
    report=audit(db)
    assert report.exists
    assert not report.issues,report
    before=(db.stat().st_mode,wal.stat().st_mode,db.read_bytes())
    assert main(["--database",str(db)])==0
    assert (db.stat().st_mode,wal.stat().st_mode,db.read_bytes())==before


def test_reject_world_readable_database_and_sidecar_without_chmod(tmp_path):
    folder=tmp_path/"private"
    folder.mkdir()
    folder.chmod(0o700)
    db=folder/"notes.sqlite3"
    db.write_bytes(b"private sample")
    db.chmod(0o644)
    journal=folder/"notes.sqlite3-journal"
    journal.write_bytes(b"journal")
    journal.chmod(0o640)
    report=audit(db)
    assert any("SQLite database" in e and "0644" in e for e in report.issues)
    assert any("rollback journal" in e and "0640" in e for e in report.issues)
    assert main(["--database",str(db)])==2
    assert stat.S_IMODE(db.stat().st_mode)==0o644
    assert stat.S_IMODE(journal.stat().st_mode)==0o640
    assert db.read_bytes()==b"private sample"


def test_symlink_detection_does_not_follow_or_modify_target(tmp_path):
    folder=tmp_path/"private"
    folder.mkdir()
    folder.chmod(0o700)
    real=folder/"outside.txt"
    real.write_text("do not touch")
    alias=folder/"notes.sqlite3"
    alias.symlink_to(real)
    result=audit(alias)
    assert result.exists
    assert any("symlink" in e for e in result.issues)
    assert real.read_text()=="do not touch"
    assert main(["--database",str(alias)])==2


def test_absent_database_reports_no_created_files(tmp_path):
    folder=tmp_path/"nothing"
    db=folder/"notes.sqlite3"
    result=audit(db)
    assert not result.exists
    assert not result.issues
    assert main(["--database",str(db)])==0
    assert not folder.exists()


def test_parent_directory_permissions_detected(tmp_path):
    folder=tmp_path/"shared"
    folder.mkdir()
    folder.chmod(0o755)
    db=folder/"notes.sqlite3"
    db.write_bytes(b"test")
    db.chmod(0o600)
    report=audit(db)
    assert any("directory" in warning and "0755" in warning for warning in report.issues)

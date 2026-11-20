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


def test_verify_archive_in_memory_never_creates_plaintext(tmp_path, monkeypatch, capsys):
    from notebook.encrypted_backup import verify_encrypted_backup, main
    original=tmp_path/"source.sqlite3"
    store=Store(str(original))
    book=store.notebooks()[0]["id"]
    note=store.create(book,"Recovery canary","PRIVATE-SECRET-RECOVERY-CANARY")
    archive=tmp_path/"recovery.gcnb"
    encrypt_backup(original,archive,SECRET)
    before={p.name:p.read_bytes() for p in tmp_path.iterdir() if p.is_file()}
    evidence=verify_encrypted_backup(archive,SECRET)
    assert evidence["authenticated"] is True
    assert evidence["ok"] is True
    assert evidence["notes"]==1
    assert evidence["notebooks"]==1
    monkeypatch.setattr("notebook.encrypted_backup.getpass.getpass",lambda _: SECRET)
    assert main(["verify","--source",str(archive)])==0
    printed=capsys.readouterr().out
    assert "VALID authenticated" in printed
    assert "PRIVATE-SECRET" not in printed and SECRET not in printed
    assert {p.name:p.read_bytes() for p in tmp_path.iterdir() if p.is_file()}==before
    assert store.get(note["id"])["body"]=="PRIVATE-SECRET-RECOVERY-CANARY"


def test_verify_refuses_wrong_password_tampering_and_symlink_swap(tmp_path, monkeypatch):
    import notebook.encrypted_backup as encrypted
    original=tmp_path/"source.sqlite3"
    Store(str(original))
    archive=tmp_path/"recovery.gcnb"
    encrypt_backup(original,archive,SECRET)
    before=set(tmp_path.iterdir())
    with pytest.raises(SnapshotError,match="authentication"):
        encrypted.verify_encrypted_backup(archive,"incorrect passphrase long enough")
    tampered=tmp_path/"tampered.gcnb"
    raw=bytearray(archive.read_bytes())
    raw[-1]^=0x80
    tampered.write_bytes(raw)
    with pytest.raises(SnapshotError,match="authentication"):
        encrypted.verify_encrypted_backup(tampered,SECRET)
    linked=tmp_path/"linked.gcnb"
    linked.symlink_to(archive)
    with pytest.raises(SnapshotError,match="symlink"):
        encrypted.verify_encrypted_backup(linked,SECRET)
    # Simulate a local attacker swapping a validated path before open().
    # O_NOFOLLOW must prevent silently reading the attacker-supplied link.
    swap=tmp_path/"swapped.gcnb"
    swap.write_bytes(archive.read_bytes())
    checked=encrypted._check_source
    def replace_after_check(path):
        resolved=checked(path)
        if resolved == swap:
            swap.unlink()
            swap.symlink_to(archive)
        return resolved
    monkeypatch.setattr(encrypted,"_check_source",replace_after_check)
    with pytest.raises(SnapshotError,match="safely read"):
        encrypted.verify_encrypted_backup(swap,SECRET)
    assert not any(p.suffix==".tmp" for p in tmp_path.iterdir())
    assert all(p in set(tmp_path.iterdir()) for p in before)

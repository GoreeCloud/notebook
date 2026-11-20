"""Encrypted, authenticated, local-only SQLite backup and restore.

Unlike the plaintext snapshot CLI, this command creates no unencrypted
intermediate files. It is a development-preview recovery tool, not encrypted
live SQLite storage or a substitute for regular offline restore drills.
"""
from __future__ import annotations

import argparse
import getpass
import os
import sqlite3
import stat
import tempfile
from pathlib import Path

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id

from .backup import SnapshotError, inspect, readonly

MAGIC = b"GCNB-ENCRYPTED-V1\x00"
SALT_SIZE = 16
NONCE_SIZE = 12
MAX_PLAINTEXT = 128 * 1024 * 1024
# These versioned parameters are fixed; changing them requires V2.
ARGON_MEMORY_KIB = 64 * 1024
ARGON_ITERATIONS = 3
ARGON_LANES = 4


def _password(password: str) -> bytes:
    if not isinstance(password, str) or len(password.encode("utf-8")) < 16:
        raise SnapshotError("Backup passphrase must contain at least 16 UTF-8 bytes")
    if len(password.encode("utf-8")) > 4096:
        raise SnapshotError("Passphrase exceeds 4096 UTF-8 bytes")
    return password.encode("utf-8")


def _derive(secret: bytes, salt: bytes) -> bytes:
    return Argon2id(
        salt=salt, length=32, iterations=ARGON_ITERATIONS,
        lanes=ARGON_LANES, memory_cost=ARGON_MEMORY_KIB
    ).derive(secret)


def _check_source(path: str | Path) -> Path:
    source=Path(path).expanduser().absolute()
    if source.is_symlink() or not source.is_file():
        raise SnapshotError("Backup source must be an existing regular file, not a symlink")
    return source


def _destination(source: Path, destination: str | Path) -> Path:
    target=Path(destination).expanduser().absolute()
    if not target.parent.is_dir():
        raise SnapshotError("Destination directory must already exist")
    if target.exists() or target.is_symlink():
        raise SnapshotError("Destination already exists; refusing to overwrite")
    if source.resolve() == target.resolve():
        raise SnapshotError("Source and destination must differ")
    return target


def _publish_bytes(destination: Path, data: bytes) -> None:
    """Write only complete content, private 0600, then atomically hard-link.

    Never truncates an existing target. Temporary file only contains the
    intended destination bytes (encrypted on backup, plaintext on restore).
    """
    fd, tmp=tempfile.mkstemp(prefix=".gcnb-private-", suffix=".tmp",
                            dir=str(destination.parent))
    try:
        os.fchmod(fd, stat.S_IRUSR | stat.S_IWUSR)
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        fd=-1
        try:
            os.link(tmp, destination)
        except FileExistsError as exc:
            raise SnapshotError("Destination appeared; refusing to overwrite") from exc
        try:
            folder_fd=os.open(destination.parent,os.O_RDONLY|getattr(os,"O_DIRECTORY",0))
            try: os.fsync(folder_fd)
            finally: os.close(folder_fd)
        except OSError:
            pass
    finally:
        if fd>=0: os.close(fd)
        Path(tmp).unlink(missing_ok=True)


def _backup_bytes(source: Path) -> bytes:
    conn=readonly(source)
    try:
        inspect(conn)
        target=sqlite3.connect(":memory:")
        try:
            conn.backup(target)
            inspect(target)
            raw=target.serialize()
            # SQLite's in-memory backup can retain a source WAL-mode file
            # header (bytes 18/19 == 2). Deserializing that WAL header into
            # an in-memory connection fails even for a valid checkpoint.
            # Mark the already-consistent serialized snapshot as rollback
            # journal mode (1/1), then independently integrity-check it.
            if raw[18:20] == b"\x02\x02":
                raw=raw[:18]+b"\x01\x01"+raw[20:]
            elif raw[18:20] != b"\x01\x01":
                raise SnapshotError("Unexpected SQLite journal format")
        except (sqlite3.Error, MemoryError) as exc:
            raise SnapshotError("Could not create in-memory SQLite snapshot") from exc
        finally:
            target.close()
    finally:
        conn.close()
    if not 0 < len(raw) <= MAX_PLAINTEXT:
        raise SnapshotError("Backup exceeds 128 MiB in-memory encryption limit")
    _inspect_bytes(raw)
    return raw


def _inspect_bytes(payload: bytes) -> dict:
    if not 0 < len(payload) <= MAX_PLAINTEXT:
        raise SnapshotError("Decrypted SQLite image size is invalid")
    connection=sqlite3.connect(":memory:")
    try:
        connection.execute("PRAGMA trusted_schema=OFF")
        connection.deserialize(payload)
        return inspect(connection)
    except (sqlite3.Error, ValueError) as exc:
        raise SnapshotError("Decrypted SQLite image is malformed") from exc
    finally:
        connection.close()


def encrypt_backup(source: str | Path, destination: str | Path,
                   password: str) -> dict:
    secret=_password(password)
    src=_check_source(source)
    dst=_destination(src,destination)
    content=_backup_bytes(src)
    salt=os.urandom(SALT_SIZE)
    nonce=os.urandom(NONCE_SIZE)
    header=MAGIC+salt+nonce
    ciphertext=AESGCM(_derive(secret,salt)).encrypt(nonce,content,header)
    _publish_bytes(dst,header+ciphertext)
    return {"format":"GCNB-ENCRYPTED-V1","bytes":dst.stat().st_size,
            "encrypted":True}


def _read_encrypted_file(source: Path) -> bytes:
    """Read a bounded regular file through one no-follow descriptor.

    A pathname may change after initial validation. This avoids following
    a substituted symlink or blocking on a substituted FIFO, while reading
    no more than the authenticated format's maximum possible envelope.
    """
    limit = MAX_PLAINTEXT + len(MAGIC) + SALT_SIZE + NONCE_SIZE + 16
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    flags |= getattr(os, "O_NONBLOCK", 0)
    try:
        fd = os.open(source, flags)
        with os.fdopen(fd, "rb") as stream:
            meta = os.fstat(stream.fileno())
            if not stat.S_ISREG(meta.st_mode):
                raise SnapshotError("Encrypted backup source is not a regular file")
            if meta.st_size > limit:
                raise SnapshotError("Encrypted backup exceeds 128 MiB limit")
            # The stream can grow even after fstat; bound the actual read.
            data = stream.read(limit + 1)
    except OSError as exc:
        raise SnapshotError("Could not safely read encrypted backup source") from exc
    if len(data) > limit:
        raise SnapshotError("Encrypted backup exceeds 128 MiB limit")
    return data


def _decrypt_verified_image(source: Path, secret: bytes) -> tuple[bytes, dict]:
    content = _read_encrypted_file(source)
    overhead = len(MAGIC) + SALT_SIZE + NONCE_SIZE + 16
    if len(content) < overhead or not content.startswith(MAGIC):
        raise SnapshotError("Unknown or truncated encrypted backup format")
    offset = len(MAGIC)
    salt = content[offset:offset + SALT_SIZE]
    nonce = content[offset + SALT_SIZE:offset + SALT_SIZE + NONCE_SIZE]
    header = content[:offset + SALT_SIZE + NONCE_SIZE]
    try:
        image = AESGCM(_derive(secret, salt)).decrypt(
            nonce, content[len(header):], header
        )
    except InvalidTag as exc:
        raise SnapshotError(
            "Incorrect passphrase or encrypted backup failed authentication"
        ) from exc
    return image, _inspect_bytes(image)


def verify_encrypted_backup(source: str | Path, password: str) -> dict:
    """Authenticate and inspect in memory; never create a plaintext file.

    This is an opt-in recovery readiness check, not an independent off-device
    restore rehearsal. Plaintext may still remain in process RAM.
    """
    secret = _password(password)
    src = _check_source(source)
    _, evidence = _decrypt_verified_image(src, secret)
    return {"format": "GCNB-ENCRYPTED-V1", "authenticated": True, **evidence}


def decrypt_backup(source: str | Path, destination: str | Path,
                   password: str) -> dict:
    secret = _password(password)
    src = _check_source(source)
    dst = _destination(src, destination)
    plaintext, evidence = _decrypt_verified_image(src, secret)
    _publish_bytes(dst, plaintext)
    return {"format": "SQLite", "restored": True, **evidence}


def main(argv: list[str] | None = None) -> int:
    parser=argparse.ArgumentParser(description="GoreeCloud Notebook encrypted offline backup")
    commands=parser.add_subparsers(dest="command",required=True)
    for name in ("backup","restore"):
        sub=commands.add_parser(name)
        sub.add_argument("--source",required=True)
        sub.add_argument("--destination",required=True,
                         help="New path, never an existing file")
    check=commands.add_parser("verify",
                              help="Authenticate and inspect in memory without writing files")
    check.add_argument("--source",required=True)
    args=parser.parse_args(argv)
    try:
        secret=getpass.getpass("Notebook backup passphrase (not echoed): ")
        if args.command=="backup":
            confirmed=getpass.getpass("Confirm passphrase: ")
            if secret!=confirmed:
                raise SnapshotError("Passphrase confirmation did not match")
            result=encrypt_backup(args.source,args.destination,secret)
            print("Encrypted backup written: AES-256-GCM with Argon2id key derivation")
        elif args.command=="restore":
            result=decrypt_backup(args.source,args.destination,secret)
            print(f"Validated SQLite restore: notes={result['notes']}, notebooks={result['notebooks']}")
            print("Restored SQLite is PLAINTEXT; protect the chosen destination.")
        else:
            result=verify_encrypted_backup(args.source,secret)
            print(f"VALID authenticated encrypted archive: notes={result['notes']}, notebooks={result['notebooks']}")
            print("Verification wrote no plaintext output; this is not a restore drill.")
        return 0
    except (SnapshotError,OSError) as exc:
        parser.exit(2,"Encrypted backup error: "+str(exc)+"\n")


if __name__ == "__main__":
    raise SystemExit(main())

"""Explicit, no-overwrite local SQLite snapshots for GoreeCloud Notebook.

This feature is plaintext and is not a substitute for encrypted backups.
Never write a database archive into a public Git repository.
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import stat
import tempfile
from pathlib import Path
from urllib.parse import quote

REQUIRED_TABLES = {"notes", "notebooks", "note_revisions"}


class SnapshotError(ValueError):
    pass


def readonly(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise SnapshotError("Source is not an existing SQLite file")
    resolved = path.resolve(strict=True)
    address = "file:" + quote(resolved.as_posix(), safe="/") + "?mode=ro"
    try:
        conn = sqlite3.connect(address, uri=True, timeout=10)
        conn.execute("PRAGMA trusted_schema=OFF")
    except sqlite3.Error as exc:
        raise SnapshotError("Could not read source database") from exc
    return conn


def inspect(conn: sqlite3.Connection) -> dict:
    try:
        check = conn.execute("PRAGMA quick_check").fetchone()
        if not check or check[0] != "ok":
            raise SnapshotError("SQLite integrity check failed")
        if conn.execute("PRAGMA foreign_key_check").fetchone():
            raise SnapshotError("Foreign key integrity check failed")
        tables = {row[0] for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}
        if not REQUIRED_TABLES.issubset(tables):
            raise SnapshotError("Source is not a GoreeCloud Notebook service database")
        return {"ok": True, "notes": conn.execute("SELECT count(*) FROM notes").fetchone()[0],
                "notebooks": conn.execute("SELECT count(*) FROM notebooks").fetchone()[0]}
    except sqlite3.Error as exc:
        raise SnapshotError("SQLite database is unreadable or corrupt") from exc


def verify(path: str | Path) -> dict:
    conn = readonly(Path(path))
    try:
        return inspect(conn)
    finally:
        conn.close()


def snapshot(source: str | Path, destination: str | Path) -> dict:
    """Take an atomic consistent snapshot and never replace the destination.

    SQLite backup() captures a coherent view even if writers are using WAL.
    Hard-link publication is atomic and fails closed when the output exists.
    """
    src = Path(source).expanduser()
    dst = Path(destination).expanduser().absolute()
    if not dst.parent.is_dir():
        raise SnapshotError("Destination directory must already exist")
    if dst.exists() or dst.is_symlink():
        raise SnapshotError("Destination already exists; refusing to overwrite")
    if src.resolve() == dst.resolve():
        raise SnapshotError("Source and destination must differ")
    source_connection = readonly(src)
    temp = None
    try:
        inspect(source_connection)
        fd, temp = tempfile.mkstemp(prefix=".notebook-snapshot-", suffix=".tmp",
                                    dir=str(dst.parent))
        os.fchmod(fd, stat.S_IRUSR | stat.S_IWUSR)
        os.close(fd)
        target_connection = sqlite3.connect(temp, timeout=10)
        try:
            source_connection.backup(target_connection)
            inspect(target_connection)
            target_connection.commit()
        finally:
            target_connection.close()
        with open(temp, "rb") as readback:
            os.fsync(readback.fileno())
        try:
            os.link(temp, dst)
        except FileExistsError as exc:
            raise SnapshotError("Destination appeared during write; not overwritten") from exc
        # Sync the directory entry where supported.
        try:
            fd = os.open(dst.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
            try:
                os.fsync(fd)
            finally:
                os.close(fd)
        except OSError:
            pass
        return verify(dst)
    except sqlite3.Error as exc:
        raise SnapshotError("SQLite snapshot failed") from exc
    finally:
        source_connection.close()
        if temp:
            Path(temp).unlink(missing_ok=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Private, plaintext SQLite snapshot/restore. Never overwrites.")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("backup", "restore"):
        sub = commands.add_parser(name)
        sub.add_argument("--source", required=True, help="Existing database/snapshot")
        sub.add_argument("--destination", required=True, help="New file; must not exist")
    sub = commands.add_parser("verify")
    sub.add_argument("--source", required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "verify":
            result = verify(args.source)
        else:
            result = snapshot(args.source, args.destination)
        print(f"VALID (notebooks={result['notebooks']}, notes={result['notes']})")
        if args.command in ("backup", "restore"):
            print("PLAIN-TEXT SNAPSHOT: secure or encrypt this file outside Notebook.")
        return 0
    except (SnapshotError, OSError) as exc:
        parser.exit(2, "Notebook snapshot error: " + str(exc) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())

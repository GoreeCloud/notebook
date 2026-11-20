"""Operator-directed native Linux offline JSON recovery, with no network access.

Only paths explicitly chosen through the Qt native file picker are accepted.
Import validates against the service's canonical transfer validator, previews,
and applies cached parsed input atomically using the shared SQLite store.
"""
from __future__ import annotations

import json
import os
import stat
from pathlib import Path

from notebook.transfer import MAX_BYTES, InvalidArchive, export_all, import_archive


class PortableJsonError(ValueError):
    pass


def _read_private_archive(path: Path) -> dict:
    # Named pipes and sockets could otherwise hang or serve unlimited content.
    flags = os.O_RDONLY | getattr(os, "O_NONBLOCK", 0)
    flags |= getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags)
    try:
        metadata = os.fstat(fd)
        if not stat.S_ISREG(metadata.st_mode):
            raise PortableJsonError("Import requires a regular JSON file")
        if metadata.st_size > MAX_BYTES:
            raise PortableJsonError("JSON archive exceeds the 8 MiB safety limit")
        with os.fdopen(fd, "rb") as stream:
            fd = -1
            raw = stream.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise PortableJsonError("JSON archive exceeds the 8 MiB safety limit")
        try:
            document = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeError, RecursionError) as exc:
            raise PortableJsonError("Archive is not valid UTF-8 JSON") from exc
        if not isinstance(document, dict):
            raise PortableJsonError("Archive must be a JSON object")
        return document
    finally:
        if fd >= 0:
            os.close(fd)


class PortableJsonRecovery:
    def __init__(self):
        self._pending: dict | None = None

    def cancel(self) -> None:
        self._pending = None

    def preview(self, store, path: Path) -> dict:
        self.cancel()
        doc = _read_private_archive(path)
        report = import_archive(store, doc, dry_run=True)
        self._pending = doc  # exactly the validated bytes, not a TOCTOU re-read
        return report

    def apply(self, store) -> dict:
        doc = self._pending
        self.cancel()  # never retry implicitly after validation/SQLite failure
        if doc is None:
            raise PortableJsonError("Select and preview an archive before importing")
        return import_archive(store, doc, dry_run=False)

    def export(self, store, path: Path) -> int:
        # Serialize and validate before creating destination, so refusal
        # leaves no partial archive. Note snapshots must be complete.
        document = export_all(store)
        try:
            payload = json.dumps(document, ensure_ascii=False,
                                 allow_nan=False, separators=(",", ":")).encode("utf-8")
        except (ValueError, TypeError, UnicodeError, RecursionError) as exc:
            raise PortableJsonError("Notebook export could not be serialized") from exc
        if len(payload) > MAX_BYTES:
            raise PortableJsonError("JSON export exceeds 8 MiB; use another supported backup method")
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        flags |= getattr(os, "O_NOFOLLOW", 0)
        fd = os.open(path, flags, 0o600)
        created = os.fstat(fd)
        try:
            with os.fdopen(fd, "wb") as stream:
                fd = -1
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
        except BaseException:
            # Do not accidentally delete a destination substituted after
            # creation; only discard our own failed inode.
            try:
                current = path.lstat()
                if current.st_dev == created.st_dev and current.st_ino == created.st_ino:
                    path.unlink()
            except OSError:
                pass
            raise
        finally:
            if fd >= 0:
                os.close(fd)
        return len(payload)

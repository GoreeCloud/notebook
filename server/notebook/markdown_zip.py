"""Safe Markdown ZIP importer for Trilium Markdown exports and ordinary folders.

No archive member is ever written to disk. Unsupported files are not silently
imported, and explicit opt-in is required before discarding their data.
"""
from __future__ import annotations

import base64
import binascii
import io
import re
import stat
import unicodedata
import zipfile
from pathlib import PurePosixPath
from uuid import UUID, uuid4

from .store import now
from .transfer import InvalidArchive, MAX_BYTES, MAX_NOTES

MAX_MEMBERS = 2400
MAX_PATH = 512
MAX_NAME = 200
# First-party ZIP exports preserve original note titles in a plain Markdown
# HTML comment. Non-GoreeCloud Markdown imports still use their file stem.
TITLE_MARKER = re.compile(r"\A<!-- GoreeCloud-Notebook-ZIP-1:([A-Za-z0-9_\-=]{1,1100}) -->\n")


def fail(message: str):
    raise InvalidArchive(message)


def member_path(filename: str) -> PurePosixPath:
    if not isinstance(filename, str) or len(filename) > MAX_PATH:
        fail("ZIP entry has invalid path length")
    if not filename or "\x00" in filename or "\\" in filename or filename.startswith("/"):
        fail("ZIP entry has unsafe path")
    filename = filename.rstrip("/")
    parts = filename.split("/")
    if any(
        not part or part in (".", "..") or part.startswith(".")
        or ":" in part or "\x00" in part
        for part in parts
    ):
        fail("ZIP entry has unsafe path")
    if len(parts) > 32:
        fail("ZIP directory nesting is too deep")
    return PurePosixPath(*parts)


def parse_markdown_zip(archive_base64: str, *, skip_unsupported: bool = False):
    if not isinstance(archive_base64, str) or len(archive_base64) > 11_200_000:
        fail("ZIP archive exceeds supported size limit")
    try:
        data = base64.b64decode(archive_base64, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise InvalidArchive("Invalid base64 ZIP archive") from exc
    if len(data) > MAX_BYTES:
        fail("ZIP archive exceeds 8 MiB limit")
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
    except (zipfile.BadZipFile, ValueError) as exc:
        raise InvalidArchive("Not a valid ZIP archive") from exc
    with z:
        members = z.infolist()
        if len(members) > MAX_MEMBERS:
            fail("Too many ZIP entries")
        paths = set()
        markdown = []
        ignored = []
        total = 0
        for item in members:
            path = member_path(item.filename)
            normalized = unicodedata.normalize("NFC", str(path)).casefold()
            if normalized in paths:
                fail("Duplicate or case-colliding ZIP entry")
            paths.add(normalized)
            mode = (item.external_attr >> 16)
            filetype = stat.S_IFMT(mode)
            if filetype not in (0, stat.S_IFREG, stat.S_IFDIR):
                fail("ZIP contains symbolic link or unsupported filesystem object")
            if item.flag_bits & 1:
                fail("Encrypted ZIP entries are not accepted")
            if item.is_dir():
                continue
            if item.file_size > MAX_BYTES:
                fail("ZIP member exceeds 8 MiB")
            total += item.file_size
            if total > MAX_BYTES:
                fail("ZIP uncompressed size exceeds 8 MiB")
            if path.suffix.lower() not in (".md", ".markdown"):
                ignored.append(str(path))
                continue
            if item.file_size > 1_000_000:
                fail("Markdown note exceeds maximum body size")
            markdown.append((path, item))
        if not markdown:
            fail("ZIP must contain at least one Markdown note")
        if ignored and not skip_unsupported:
            fail("ZIP contains unsupported data. Set skip_unsupported=true to OMIT non-Markdown entries.")
        if len(markdown) > MAX_NOTES:
            fail("Too many Markdown notes")
        stamp = now()
        notebook_id = str(uuid4())
        notes = []
        folders = {}
        # A note represented as Name.md and Name/child.md is its own parent,
        # not a synthetic placeholder. This enables first-party Markdown
        # subtree exports to retain note hierarchy while remaining plain ZIPs.
        markdown_ids = {str(path.with_suffix("")):str(uuid4()) for path,_ in markdown}
        def folder_note(path):
            key = str(path)
            if key in markdown_ids:
                return markdown_ids[key]
            name = path.name
            if not 1 <= len(name) <= MAX_NAME:
                fail("Invalid folder name")
            if str(path) not in folders:
                pid = folder_note(path.parent) if str(path.parent) != "." else None
                record = {"id":str(uuid4()), "notebook_id":notebook_id,
                          "parent_id":pid,"title":name,"body":"",
                          "tags":[],"pinned":False,"deleted_at":None,
                          "version":1,"created_at":stamp,"updated_at":stamp}
                notes.append(record)
                folders[str(path)] = record["id"]
            return folders[str(path)]
        for path, item in sorted(markdown, key=lambda entry: str(entry[0]).casefold()):
            folder = path.parent
            parent = folder_note(folder) if str(folder) != "." else None
            title = path.stem.strip()
            if not title or len(title) > MAX_NAME:
                fail("Invalid Markdown note title")
            try:
                with z.open(item, "r") as fp:
                    raw = fp.read(1_000_001)
            except (OSError, RuntimeError, zipfile.BadZipFile) as exc:
                raise InvalidArchive("ZIP member cannot be read safely") from exc
            if len(raw) > 1_000_000:
                fail("Uncompressed Markdown note exceeds limit")
            try:
                body = raw.decode("utf-8-sig")
            except UnicodeDecodeError as exc:
                raise InvalidArchive("Markdown notes must be UTF-8") from exc
            header = TITLE_MARKER.match(body)
            if header:
                try:
                    decoded = base64.urlsafe_b64decode(header.group(1).encode("ascii")).decode("utf-8")
                except (UnicodeDecodeError, binascii.Error, ValueError) as exc:
                    raise InvalidArchive("Invalid GoreeCloud note title marker") from exc
                if not decoded.strip() or len(decoded) > MAX_NAME:
                    fail("Invalid title in Markdown ZIP note marker")
                title = decoded
                body = body[header.end():]
            notes.append({"id":markdown_ids[str(path.with_suffix(""))],"notebook_id":notebook_id,
                          "parent_id":parent,"title":title,"body":body,
                          "tags":[],"pinned":False,"deleted_at":None,
                          "version":1,"created_at":stamp,"updated_at":stamp})
            if len(notes) > MAX_NOTES:
                fail("Folder and note count exceeds 2000")
        warnings = [
            "Original filename, tags, links and Trilium note IDs are not tracked.",
            "Directories without matching Markdown note files become placeholder notes.",
            "Embedded links, media references, attachments and Trilium metadata are not rewritten."
        ]
        if ignored:
            warnings.append(f"Unsupported files omitted with consent: {len(ignored)}.")
        archive = {"format":"goreecloud-notebook-v2",
                   "notebooks":[{"id":notebook_id,"name":"Markdown ZIP Import",
                                 "created_at":stamp}],
                   "notes":notes,"revisions":[]}
        return archive, warnings

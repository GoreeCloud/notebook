"""Optional plaintext Markdown ZIP export, for human-readable data portability.

JSON v2 and SQLite snapshots remain the authoritative recovery formats.
This format intentionally omits revision history, tag lists and pinning.
"""
from __future__ import annotations

import base64
import io
import re
import unicodedata
import zipfile
from pathlib import PurePosixPath
from uuid import UUID

from .markdown_zip import MAX_MEMBERS, MAX_NAME, MAX_PATH
from .transfer import MAX_BYTES, MAX_NOTES, InvalidArchive

TITLE_MARKER = "<!-- GoreeCloud-Notebook-ZIP-1:{} -->\n"


def slug(title: str) -> str:
    cleaned = unicodedata.normalize("NFC", title)
    cleaned = re.sub(r"[^\w \-()]", "_", cleaned, flags=re.UNICODE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ._")
    return cleaned[:36].strip() or "note"


def make_markdown_zip(store) -> bytes:
    # A single read snapshot is essential: a notebook created concurrently
    # between these SELECTs could otherwise yield orphaned ZIP entries or
    # mixed-generation exports. WAL writers may continue while we read.
    with store.connection() as db:
        db.execute("BEGIN")
        books = [dict(x) for x in db.execute("SELECT * FROM notebooks ORDER BY id")]
        notes = [dict(x) for x in db.execute(
            "SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY notebook_id, id")]
    if not notes:
        raise InvalidArchive("No active notes to export as Markdown")
    if len(notes) > MAX_NOTES or len(notes) > MAX_MEMBERS:
        raise InvalidArchive("Too many notes for one Markdown ZIP")
    by_id = {n["id"]: n for n in notes}
    book_ids = {b["id"] for b in books}
    if any(n["notebook_id"] not in book_ids for n in notes):
        raise InvalidArchive("Note refers to a missing notebook")
    multiple = len({n["notebook_id"] for n in notes}) > 1
    book_by_id = {b["id"]: b for b in books}

    def stem(note) -> str:
        try:
            suffix = UUID(note["id"]).hex[:12]
        except (ValueError, TypeError, AttributeError) as exc:
            raise InvalidArchive("Invalid note ID in local database") from exc
        return slug(note["title"]) + "--" + suffix

    path_cache = {}
    def note_stem_path(note_id, active=None):
        if note_id in path_cache:
            return path_cache[note_id]
        active = set() if active is None else active
        if note_id in active:
            raise InvalidArchive("Circular note hierarchy prevents Markdown export")
        note = by_id[note_id]
        active.add(note_id)
        parent = note.get("parent_id")
        if parent and parent in by_id:
            if by_id[parent]["notebook_id"] != note["notebook_id"]:
                raise InvalidArchive("Note parent is in another notebook")
            base = note_stem_path(parent, active)
        else:
            base = PurePosixPath(".")
            if multiple:
                book=book_by_id[note["notebook_id"]]
                base = PurePosixPath(slug(book["name"]) + "--" +
                                     UUID(book["id"]).hex[:12])
        result = base / stem(note)
        if len(str(result)) > MAX_PATH - 3 or len(result.parts) > 32:
            raise InvalidArchive("Nested note path is too long for Markdown ZIP")
        path_cache[note_id] = result
        active.remove(note_id)
        return result

    archive=io.BytesIO()
    declared_bytes=0
    names=set()
    with zipfile.ZipFile(archive,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for note in notes:
            filename=str(note_stem_path(note["id"]))+".md"
            if filename in names:
                raise InvalidArchive("Duplicate filename for Markdown export")
            names.add(filename)
            title_bytes=note["title"].encode("utf-8")
            title64=base64.urlsafe_b64encode(title_bytes).decode("ascii")
            payload=(TITLE_MARKER.format(title64)+note["body"]).encode("utf-8")
            declared_bytes+=len(payload)
            if len(payload)>1_000_000 or declared_bytes>MAX_BYTES:
                raise InvalidArchive("Markdown export exceeds the 8 MiB uncompressed limit")
            item=zipfile.ZipInfo(filename,date_time=(1980,1,1,0,0,0))
            item.create_system=3
            item.external_attr=(0o100644)<<16
            item.compress_type=zipfile.ZIP_DEFLATED
            z.writestr(item,payload,compress_type=zipfile.ZIP_DEFLATED)
    contents=archive.getvalue()
    if len(contents)>MAX_BYTES:
        raise InvalidArchive("Markdown ZIP exceeds 8 MiB compressed limit")
    return contents

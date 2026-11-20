"""Validated, transactional notebook JSON recovery. Never overwrites existing data."""
from __future__ import annotations

import json
from datetime import datetime
from uuid import UUID, uuid4

MAX_BYTES = 8 * 1024 * 1024
MAX_NOTES = 2000
MAX_BOOKS = 200
MAX_REVISIONS = 10000


class InvalidArchive(ValueError):
    """Untrusted import content failed validation."""


def reject(message: str):
    raise InvalidArchive(message)


def uid(value, what):
    if not isinstance(value, str) or len(value) > 60:
        reject("Invalid " + what)
    try:
        return str(UUID(value))
    except (ValueError, AttributeError) as exc:
        raise InvalidArchive("Invalid " + what) from exc


def text(value, label, max_len, *, required=False):
    if not isinstance(value, str) or len(value) > max_len or (required and not value.strip()):
        reject("Invalid " + label)
    return value


def stamp(value, label, nullable=False):
    if value is None and nullable:
        return None
    text(value, label, 50, required=True)
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            reject("Timestamp must include timezone: " + label)
    except ValueError as exc:
        raise InvalidArchive("Invalid timestamp: " + label) from exc
    return value


def validate(document):
    if not isinstance(document, dict):
        reject("Expected a notebook export object")
    try:
        raw = json.dumps(document, ensure_ascii=False, allow_nan=False).encode("utf-8")
    except (ValueError, TypeError, RecursionError) as exc:
        raise InvalidArchive("Invalid JSON values") from exc
    if len(raw) > MAX_BYTES:
        reject("Archive exceeds 8 MiB limit")
    if document.get("format") not in ("goreecloud-notebook-v1", "goreecloud-notebook-v2"):
        reject("Unknown archive format")
    books, notes, revisions = (document.get("notebooks"),
                               document.get("notes"), document.get("revisions", []))
    if not isinstance(books, list) or not 1 <= len(books) <= MAX_BOOKS:
        reject("Invalid notebook count")
    if not isinstance(notes, list) or len(notes) > MAX_NOTES:
        reject("Invalid note count")
    if not isinstance(revisions, list) or len(revisions) > MAX_REVISIONS:
        reject("Invalid revisions")
    cleaned_books, cleaned_notes, cleaned_revisions = [], [], []
    book_ids, note_ids, revision_keys = set(), set(), set()
    for item in books:
        if not isinstance(item, dict):
            reject("Malformed notebook")
        bid = uid(item.get("id"), "notebook ID")
        if bid in book_ids:
            reject("Duplicate notebook ID")
        book_ids.add(bid)
        cleaned_books.append({
            "id":bid,
            "name":text(item.get("name"),"notebook name",120,required=True),
            "created_at":stamp(item.get("created_at"),"notebook created_at")
        })
    for item in notes:
        if not isinstance(item, dict):
            reject("Malformed note")
        nid = uid(item.get("id"),"note ID")
        if nid in note_ids:
            reject("Duplicate note ID")
        note_ids.add(nid)
        bid = uid(item.get("notebook_id"),"note notebook ID")
        if bid not in book_ids:
            reject("Note refers to missing notebook")
        parent = item.get("parent_id")
        if parent is not None:
            parent = uid(parent,"parent note ID")
            if parent == nid:
                reject("Self-referential note parent")
        tags = item.get("tags", [])
        if not isinstance(tags,list) or len(tags)>20 or any(
            not isinstance(t,str) or not t.strip() or len(t)>64 for t in tags
        ):
            reject("Invalid note tags")
        version = item.get("version",1)
        if type(version) is not int or not 1 <= version <= 1_000_000:
            reject("Invalid note version")
        if type(item.get("pinned",False)) is not bool:
            reject("Invalid pinned flag")
        cleaned_notes.append({
            "id":nid,"notebook_id":bid,"parent_id":parent,
            "title":text(item.get("title"),"note title",200,required=True),
            "body":text(item.get("body", ""),"note body",1_000_000),
            "tags":tags,"pinned":item.get("pinned",False),
            "deleted_at":stamp(item.get("deleted_at"),"deleted_at",nullable=True),
            "version":version,
            "created_at":stamp(item.get("created_at"),"note created_at"),
            "updated_at":stamp(item.get("updated_at"),"note updated_at")
        })
    by_id = {n["id"]:n for n in cleaned_notes}
    for note in cleaned_notes:
        cursor, visited = note["parent_id"], {note["id"]}
        while cursor:
            if cursor in visited:
                reject("Circular note hierarchy")
            visited.add(cursor)
            parent = by_id.get(cursor)
            if parent is None or parent["notebook_id"] != note["notebook_id"]:
                reject("Parent must be in same exported notebook")
            cursor = parent["parent_id"]
    for item in revisions:
        if not isinstance(item,dict):
            reject("Malformed revision")
        nid = uid(item.get("note_id"),"revision note ID")
        note = by_id.get(nid)
        if not note:
            reject("Revision refers to missing note")
        version = item.get("version")
        if type(version) is not int or not 1 <= version < note["version"]:
            reject("Invalid revision version")
        key=(nid,version)
        if key in revision_keys:
            reject("Duplicate note revision")
        revision_keys.add(key)
        cleaned_revisions.append({
            "note_id":nid,"version":version,
            "title":text(item.get("title"),"revision title",200,required=True),
            "body":text(item.get("body"),"revision body",1_000_000),
            "saved_at":stamp(item.get("saved_at"),"revision saved_at")
        })
    return cleaned_books, cleaned_notes, cleaned_revisions


def import_archive(store, document, dry_run=True):
    books, notes, revisions = validate(document)
    report={"mode":"append-only", "dry_run":bool(dry_run),
            "notebooks":len(books),"notes":len(notes),"revisions":len(revisions),
            "preserves_hierarchy":True,
            "warnings":["Imported records receive new IDs; existing content is never overwritten."]}
    if dry_run:
        return report

    book_map={x["id"]:str(uuid4()) for x in books}
    note_map={x["id"]:str(uuid4()) for x in notes}
    pending={x["id"]:x for x in notes}
    with store.connection() as db:
        for book in books:
            db.execute("INSERT INTO notebooks(id,name,created_at) VALUES(?,?,?)",
                       (book_map[book["id"]],book["name"],book["created_at"]))
        while pending:
            advanced=False
            for old_id, note in list(pending.items()):
                parent=note["parent_id"]
                if parent is not None and parent in pending:
                    continue
                db.execute(
                    """INSERT INTO notes(id,notebook_id,parent_id,title,body,tags,pinned,
                       deleted_at,version,created_at,updated_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                    (note_map[old_id],book_map[note["notebook_id"]],
                     note_map.get(parent),note["title"],note["body"],
                     json.dumps(note["tags"]),int(note["pinned"]),
                     note["deleted_at"],note["version"],
                     note["created_at"],note["updated_at"]))
                del pending[old_id]
                advanced=True
            if not advanced:
                reject("Invalid hierarchy")
        for revision in revisions:
            db.execute(
                """INSERT INTO note_revisions(note_id,version,title,body,saved_at)
                   VALUES(?,?,?,?,?)""",
                (note_map[revision["note_id"]],revision["version"],
                 revision["title"],revision["body"],revision["saved_at"]))
    report["dry_run"]=False
    return report


def export_all(store):
    with store.connection() as db:
        # One SQLite read transaction gives consistent notebook/note/revision
        # rows, including when a separate writer updates content concurrently.
        db.execute("BEGIN")
        books=[dict(row) for row in db.execute("SELECT * FROM notebooks ORDER BY id")]
        notes=[store.note(row) for row in db.execute("SELECT * FROM notes ORDER BY id")]
        revisions=[dict(row) for row in db.execute(
            "SELECT * FROM note_revisions ORDER BY note_id, version")]
    return {"format":"goreecloud-notebook-v2",
            "notebooks":books,"notes":notes,"revisions":revisions}

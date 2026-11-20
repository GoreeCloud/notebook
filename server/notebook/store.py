"""SQLite persistence; no hidden cloud transmission or privileged operations."""
from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


class NotFound(Exception):
    pass


class Conflict(Exception):
    pass


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, filename: str):
        self.filename = str(Path(filename).expanduser())
        Path(self.filename).parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        database = Path(self.filename)
        if database.is_symlink():
            raise ValueError("Refusing a symlinked Notebook database")
        if not database.exists():
            # Preserve existing file modes, but create new databases as
            # private 0600 even when the process umask is permissive.
            try:
                flags = os.O_CREAT | os.O_EXCL | os.O_RDWR
                flags |= getattr(os, "O_NOFOLLOW", 0)
                fd = os.open(self.filename, flags, 0o600)
                os.close(fd)
            except FileExistsError:
                pass
        if database.is_symlink():
            raise ValueError("Refusing a symlinked Notebook database")
        with self.connection() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS notebooks (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY, notebook_id TEXT NOT NULL
                        REFERENCES notebooks(id) ON DELETE RESTRICT,
                    parent_id TEXT REFERENCES notes(id) ON DELETE RESTRICT,
                    title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
                    tags TEXT NOT NULL DEFAULT '[]',
                    pinned INTEGER NOT NULL DEFAULT 0,
                    deleted_at TEXT,
                    version INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS note_revisions (
                    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                    version INTEGER NOT NULL, title TEXT NOT NULL,
                    body TEXT NOT NULL, saved_at TEXT NOT NULL,
                    PRIMARY KEY(note_id, version)
                );
                CREATE INDEX IF NOT EXISTS notes_by_notebook
                    ON notes(notebook_id, deleted_at, updated_at);
                CREATE INDEX IF NOT EXISTS notes_by_parent
                    ON notes(parent_id);
            """)
            # Append-only local mutation cursors for an eventual Mesh protocol.
            # Triggers also cover direct writes from the JSON/ENEX import paths.
            db.executescript("""
                CREATE TABLE IF NOT EXISTS note_change_events (
                    cursor INTEGER PRIMARY KEY AUTOINCREMENT,
                    note_id TEXT NOT NULL,
                    notebook_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    deleted_at TEXT,
                    recorded_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS note_changes_by_notebook
                    ON note_change_events(notebook_id, cursor);
            """)
            # Existing databases have no event history. Seed their current
            # states exactly once before enabling triggers; old revisions are
            # intentionally not reconstructed.
            if not db.execute("SELECT 1 FROM note_change_events LIMIT 1").fetchone():
                db.execute("""
                    INSERT INTO note_change_events
                    (note_id, notebook_id, version, deleted_at, recorded_at)
                    SELECT id, notebook_id, version, deleted_at, updated_at FROM notes
                    ORDER BY updated_at, id
                """)
            db.executescript("""
                CREATE TRIGGER IF NOT EXISTS notebook_note_added
                AFTER INSERT ON notes BEGIN
                    INSERT INTO note_change_events
                    (note_id, notebook_id, version, deleted_at, recorded_at)
                    VALUES (NEW.id,NEW.notebook_id,NEW.version,NEW.deleted_at,
                            strftime('%Y-%m-%dT%H:%M:%fZ','now'));
                END;
                CREATE TRIGGER IF NOT EXISTS notebook_note_updated
                AFTER UPDATE ON notes BEGIN
                    INSERT INTO note_change_events
                    (note_id, notebook_id, version, deleted_at, recorded_at)
                    VALUES (NEW.id,NEW.notebook_id,NEW.version,NEW.deleted_at,
                            strftime('%Y-%m-%dT%H:%M:%fZ','now'));
                END;
            """)
            if not db.execute("SELECT 1 FROM notebooks LIMIT 1").fetchone():
                db.execute(
                    "INSERT INTO notebooks VALUES (?, ?, ?)",
                    (str(uuid4()), "My Notebook", now()),
                )

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.filename, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA busy_timeout=10000")
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    @staticmethod
    def note(row):
        d = dict(row)
        d["tags"] = json.loads(d["tags"])
        d["pinned"] = bool(d["pinned"])
        return d

    def notebooks(self):
        with self.connection() as db:
            return [dict(row) for row in db.execute(
                "SELECT * FROM notebooks ORDER BY name COLLATE NOCASE")]

    def create_notebook(self, name):
        notebook_id = str(uuid4())
        with self.connection() as db:
            db.execute("INSERT INTO notebooks VALUES (?, ?, ?)",
                       (notebook_id, name, now()))
        return {"id": notebook_id, "name": name}

    def ensure_notebook(self, db, notebook_id):
        if not db.execute("SELECT 1 FROM notebooks WHERE id=?", (notebook_id,)).fetchone():
            raise NotFound("Notebook not found")

    def ensure_parent(self, db, parent_id, notebook_id, note_id=None):
        if parent_id is None:
            return
        if parent_id == note_id:
            raise Conflict("A note cannot be its own parent")
        parent = db.execute(
            "SELECT notebook_id,parent_id,deleted_at FROM notes WHERE id=?", (parent_id,)
        ).fetchone()
        if not parent or parent["notebook_id"] != notebook_id or parent["deleted_at"]:
            raise Conflict("Parent must be an active note in the same notebook")
        visited = {note_id, parent_id}
        cursor = parent["parent_id"]
        while cursor is not None:
            if cursor in visited:
                raise Conflict("Circular note hierarchy")
            visited.add(cursor)
            current = db.execute("SELECT parent_id FROM notes WHERE id=?", (cursor,)).fetchone()
            cursor = current["parent_id"] if current else None

    def list_notes(self, notebook_id=None, q="", include_deleted=False):
        predicates = []
        args = []
        if notebook_id:
            predicates.append("notebook_id=?")
            args.append(notebook_id)
        if not include_deleted:
            predicates.append("deleted_at IS NULL")
        if q:
            escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            predicates.append("(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')")
            args.extend(["%" + escaped + "%"] * 2)
        where = " WHERE " + " AND ".join(predicates) if predicates else ""
        with self.connection() as db:
            rows = db.execute(
                "SELECT * FROM notes" + where +
                " ORDER BY pinned DESC, updated_at DESC, id LIMIT 500", args
            ).fetchall()
        return [self.note(row) for row in rows]

    def get(self, note_id, include_deleted=False):
        with self.connection() as db:
            row = db.execute("SELECT * FROM notes WHERE id=?", (note_id,)).fetchone()
        if not row or (row["deleted_at"] and not include_deleted):
            raise NotFound("Note not found")
        return self.note(row)

    def create(self, notebook_id, title, body="", parent_id=None, tags=None):
        note_id, stamp = str(uuid4()), now()
        with self.connection() as db:
            self.ensure_notebook(db, notebook_id)
            self.ensure_parent(db, parent_id, notebook_id)
            db.execute(
                """INSERT INTO notes
                    (id, notebook_id, parent_id, title, body, tags, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (note_id, notebook_id, parent_id, title, body, json.dumps(tags or []), stamp, stamp))
        return self.get(note_id)

    def update(self, note_id, changes, expected_version):
        allowed = {"title", "body", "notebook_id", "parent_id", "tags", "pinned", "deleted_at"}
        if not changes or not set(changes).issubset(allowed):
            raise Conflict("No editable fields provided")
        with self.connection() as db:
            old = db.execute("SELECT * FROM notes WHERE id=?", (note_id,)).fetchone()
            if not old:
                raise NotFound("Note not found")
            if old["version"] != expected_version:
                raise Conflict("Out-of-date version; reload before saving")
            data = dict(old)
            data.update(changes)
            self.ensure_notebook(db, data["notebook_id"])
            self.ensure_parent(db, data["parent_id"], data["notebook_id"], note_id)
            if "tags" in changes:
                data["tags"] = json.dumps(data["tags"])
            if "pinned" in changes:
                data["pinned"] = int(data["pinned"])
            db.execute(
                """INSERT INTO note_revisions (note_id,version,title,body,saved_at)
                   VALUES (?,?,?,?,?)""",
                (note_id, old["version"], old["title"], old["body"], now()))
            db.execute(
                """UPDATE notes SET notebook_id=?, parent_id=?, title=?, body=?,
                   tags=?, pinned=?, deleted_at=?, version=version+1, updated_at=?
                   WHERE id=? AND version=?""",
                (data["notebook_id"], data["parent_id"], data["title"], data["body"],
                 data["tags"], data["pinned"], data["deleted_at"], now(),
                 note_id, expected_version))
        return self.get(note_id, include_deleted=True)

    def revisions(self, note_id):
        self.get(note_id, include_deleted=True)
        with self.connection() as db:
            return [dict(x) for x in db.execute(
                "SELECT * FROM note_revisions WHERE note_id=? ORDER BY version DESC",
                (note_id,))]

    def restore_revision(self, note_id, version, expected_version):
        with self.connection() as db:
            row = db.execute(
                "SELECT title, body FROM note_revisions WHERE note_id=? AND version=?",
                (note_id, version)).fetchone()
            if not row:
                raise NotFound("Revision not found")
        return self.update(note_id, {"title": row["title"], "body": row["body"]}, expected_version)

    def backlinks(self, note_id):
        target = self.get(note_id)
        needle = "[[" + target["title"].casefold() + "]]"
        return [note for note in self.list_notes() if
                note["id"] != note_id and needle in note["body"].casefold()]

    def changes(self, after_cursor=0, limit=100):
        # Monotonic local SQLite cursors, not per-device Mesh sync.
        with self.connection() as db:
            records = [dict(row) for row in db.execute(
                """SELECT cursor,note_id,notebook_id,version,deleted_at,recorded_at
                   FROM note_change_events WHERE cursor>?
                   ORDER BY cursor LIMIT ?""",
                (after_cursor, limit + 1))]
            last = db.execute(
                "SELECT COALESCE(MAX(cursor),0) AS latest FROM note_change_events"
            ).fetchone()["latest"]
        visible = records[:limit]
        return {
            "events": visible,
            "after_cursor": after_cursor,
            "next_cursor": visible[-1]["cursor"] if visible else after_cursor,
            "latest_cursor": last,
            "has_more": len(records) > limit,
            "scope": "local-notebook-metadata-only"
        }

    def export(self):
        return {"format": "goreecloud-notebook-v1", "notebooks": self.notebooks(),
                "notes": self.list_notes(include_deleted=True)}

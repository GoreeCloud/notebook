"""Deterministic WAL race: high-water mark and page are one read snapshot."""
from contextlib import contextmanager
import sqlite3

from notebook.store import Store


def test_concurrent_writer_does_not_appear_after_snapshot_ceiling(tmp_path):
    filename = str(tmp_path / "changes.sqlite3")
    store = Store(filename)
    book = store.notebooks()[0]["id"]
    before = store.create(book, "Before high-water mark")

    # WAL lets a different connection commit while the first holds a read
    # snapshot. No user data or external service is used by this regression.
    with sqlite3.connect(filename) as db:
        assert db.execute("PRAGMA journal_mode=WAL").fetchone()[0] == "wal"
    other = Store(filename)

    original_connection = store.connection
    injected = []

    @contextmanager
    def intervening_connection():
        with original_connection() as db:
            class Cursor:
                def __init__(self, inner):
                    self.inner = inner

                def fetchone(self):
                    row = self.inner.fetchone()
                    if not injected:
                        injected.append(other.create(book, "After high-water mark"))
                    return row

            class Connection:
                def execute(self, sql, args=()):
                    cursor = db.execute(sql, args)
                    if "MAX(cursor)" in sql:
                        return Cursor(cursor)
                    return cursor

            yield Connection()

    store.connection = intervening_connection
    page = store.changes(after_cursor=0, limit=100)
    assert len(injected) == 1
    assert page["has_more"] is False
    assert [event["note_id"] for event in page["events"]] == [before["id"]]
    assert page["latest_cursor"] == page["next_cursor"]
    assert page["latest_cursor"] < other.changes()["latest_cursor"]
    store.connection = original_connection
    later = store.changes(after_cursor=page["next_cursor"])
    assert [event["note_id"] for event in later["events"]] == [injected[0]["id"]]

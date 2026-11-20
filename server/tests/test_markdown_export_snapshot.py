"""Concurrent notebook mutations must not produce a torn Markdown ZIP."""
from contextlib import contextmanager
import io
import sqlite3
import zipfile

from notebook.markdown_export import make_markdown_zip
from notebook.store import Store


def test_markdown_zip_uses_one_snapshot_with_concurrent_wal_writer(tmp_path):
    path = str(tmp_path / "notebook.sqlite3")
    store = Store(path)
    book = store.notebooks()[0]["id"]
    original = store.create(book, "Before concurrent write", "content before")
    with sqlite3.connect(path) as connection:
        assert connection.execute("PRAGMA journal_mode=WAL").fetchone()[0] == "wal"
    other = Store(path)
    connection_factory = store.connection
    concurrent = []

    @contextmanager
    def interleaved_reader():
        with connection_factory() as db:
            class Result:
                def __init__(self, cursor):
                    self.cursor = cursor

                def __iter__(self):
                    for row in self.cursor:
                        yield row
                    if not concurrent:
                        second = other.create_notebook("Concurrent notebook")
                        concurrent.append(other.create(
                            second["id"], "After concurrent write", "new content"
                        ))

            class Connection:
                def execute(self, query, args=()):
                    cursor = db.execute(query, args)
                    if "SELECT * FROM notebooks" in query:
                        return Result(cursor)
                    return cursor

            yield Connection()

    store.connection = interleaved_reader
    archive = make_markdown_zip(store)
    store.connection = connection_factory
    assert len(concurrent) == 1
    assert other.get(concurrent[0]["id"])["title"] == "After concurrent write"
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_file:
        files = [p for p in zip_file.namelist() if p.endswith(".md")]
        assert len(files) == 1
        assert "Before concurrent write" in files[0]
        assert "content before" in zip_file.read(files[0]).decode("utf-8")
        assert "After concurrent write" not in zip_file.read(files[0]).decode("utf-8")
    assert store.get(original["id"])["body"] == "content before"

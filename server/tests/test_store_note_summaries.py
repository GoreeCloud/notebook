"""Native list summaries and Trash pages never inherit the 500-active cap."""
from notebook.store import Store


def test_summary_paging_large_collection_and_sql_trash_only(tmp_path):
    store = Store(str(tmp_path / "summaries.sqlite3"))
    book = store.notebooks()[0]["id"]
    with store.connection() as db:
        for i in range(535):
            db.execute(
                """INSERT INTO notes (id,notebook_id,title,body,tags,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?)""",
                (f"active-{i:04}", book, f"Note {i:04}", "x" * 300,
                 "[]", "2026-11-20T00:00:00Z", "2026-11-20T00:00:00Z"),
            )
        for i in range(2):
            db.execute(
                """INSERT INTO notes (id,notebook_id,title,body,tags,deleted_at,
                created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)""",
                (f"trashed-{i}", book, "Deleted", "secret that remains in Trash",
                 "[]", "2026-11-20T00:00:00Z",
                 "2026-11-20T00:00:00Z", "2026-11-20T00:00:00Z"),
            )
    first = store.list_notes_page(summary_only=True, limit=500)
    next_page = store.list_notes_page(summary_only=True, limit=500, offset=500)
    assert first["has_more"] and not next_page["has_more"]
    ids = [r["id"] for r in first["results"] + next_page["results"]]
    assert len(ids) == len(set(ids)) == 535
    assert all("body" not in r and len(r["preview"]) == 160 for r in first["results"])
    assert len(store.list_notes(include_deleted=True)) == 500
    trash = store.list_notes_page(deleted_only=True, limit=500, summary_only=True)
    assert {r["id"] for r in trash["results"]} == {"trashed-0", "trashed-1"}
    assert not trash["has_more"]
    assert all("body" not in r and "secret" in r["preview"] for r in trash["results"])


def test_summary_scope_search_and_default_full_body_unchanged(tmp_path):
    store = Store(str(tmp_path / "scope.sqlite3"))
    first = store.notebooks()[0]["id"]
    second = store.create_notebook("Other")["id"]
    target = store.create(first, "Found", "a" * 200 + "keyword")
    store.create(second, "Found", "also keyword")
    filtered = store.list_notes_page(notebook_id=first, q="keyword",
                                     summary_only=True)
    assert [r["id"] for r in filtered["results"]] == [target["id"]]
    assert len(filtered["results"][0]["preview"]) == 160
    assert store.get(target["id"])["body"].endswith("keyword")
    assert store.list_notes_page(notebook_id=first)["results"][0]["body"].endswith("keyword")

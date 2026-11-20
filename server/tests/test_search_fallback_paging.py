"""Search fallback must not silently truncate SQLite libraries at 500 notes."""
from notebook.store import Store


def test_large_fallback_collection_is_fully_paginated(tmp_path):
    store = Store(str(tmp_path / "fallback.sqlite3"))
    book = store.notebooks()[0]["id"]
    with store.connection() as db:
        for i in range(535):
            db.execute(
                """INSERT INTO notes (id,notebook_id,title,body,tags,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?)""",
                (f"note-{i:04}", book, f"Galaxy {i:04}", "starlight",
                 '["astronomy"]', "2026-11-20T00:00:00Z",
                 "2026-11-20T00:00:00Z"),
            )
    store.fts_enabled = False
    pages = [store.search_ranked("starlight", limit=200, offset=x)
             for x in (0, 200, 400)]
    assert all(page["backend"] == "like" for page in pages)
    assert [page["has_more"] for page in pages] == [True, True, False]
    ids = [note["id"] for page in pages for note in page["results"]]
    assert len(ids) == len(set(ids)) == 535
    assert {note["id"] for note in store.search_ranked(
        "GALAXY astronomy", limit=200)["results"]} == set(ids[:200])


def test_fallback_scopes_and_excludes_trash_before_offset(tmp_path):
    store = Store(str(tmp_path / "scope.sqlite3"))
    first = store.notebooks()[0]["id"]
    second = store.create_notebook("Second")["id"]
    target = store.create(first, "Question_with_% symbols", "meteorites", tags=["comets"])
    other = store.create(second, "Meteorites", "comets")
    trashed = store.create(first, "Meteorites", "comets")
    store.update(trashed["id"], {"deleted_at": "2026-11-20T00:00:00Z"}, 1)
    store.fts_enabled = False
    only = store.search_ranked("meteorites comets", notebook_id=first, limit=1)
    assert [x["id"] for x in only["results"]] == [target["id"]]
    assert not only["has_more"]
    assert store.search_ranked("comets", notebook_id=first, offset=1)["results"] == []
    assert {x["id"] for x in store.search_ranked(
        "meteorites", limit=10)["results"]} == {target["id"], other["id"]}
    assert store.search_ranked("not_present", limit=1)["results"] == []

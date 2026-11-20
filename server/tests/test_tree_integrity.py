import os

os.environ["GC_NOTEBOOK_TOKEN"] = "test-only-32-characters-secret-0000"
from fastapi.testclient import TestClient
from notebook.main import create_app
from notebook.store import Store, Conflict

AUTH={"Authorization":"Bearer "+os.environ["GC_NOTEBOOK_TOKEN"]}


def test_reject_cross_notebook_parent_move_without_losing_tree(tmp_path):
    store=Store(str(tmp_path/"notes.sqlite3"))
    a=store.notebooks()[0]["id"]
    b=store.create_notebook("Second")["id"]
    p=store.create(a,"Parent")
    c=store.create(a,"Child",parent_id=p["id"])
    try:
        store.update(p["id"],{"notebook_id":b},1)
        raise AssertionError("moved a parent without its child")
    except Conflict as e:
        assert "child" in str(e).lower()
    assert store.get(p["id"])["notebook_id"]==a
    assert store.get(c["id"])["parent_id"]==p["id"]
    assert store.revisions(p["id"])==[]
    moved=store.update(c["id"],{"parent_id":None,"notebook_id":b},1)
    assert moved["notebook_id"]==b
    assert store.update(p["id"],{"notebook_id":b},1)["notebook_id"]==b


def test_soft_delete_parent_preserves_children_and_disallows_trash_edits(tmp_path):
    # Existing API semantics allow moving a parent to Trash while an active
    # child remains. Preserve that compatibility; restoring parent recovers
    # the tree, and hidden Trash edits cannot bypass restoration.
    store=Store(str(tmp_path/"notes.sqlite3"))
    book=store.notebooks()[0]["id"]
    p=store.create(book,"Parent")
    c=store.create(book,"Child",parent_id=p["id"])
    store.update(p["id"],{"deleted_at":"2026-11-20T14:00:00+00:00"},1)
    assert store.get(c["id"])["parent_id"]==p["id"]
    with __import__("pytest").raises(Conflict,match="Restore"):
        store.update(p["id"],{"title":"Unauthorized trashed edit"},2)
    store.update(p["id"],{"deleted_at":None},2)
    assert store.get(p["id"])["deleted_at"] is None
    assert store.get(c["id"])["parent_id"]==p["id"]


def test_patch_tag_validation_before_storage_write(tmp_path):
    c=TestClient(create_app(str(tmp_path/"notes.sqlite3"),token=os.environ["GC_NOTEBOOK_TOKEN"]))
    book=c.get("/api/v1/notebooks",headers=AUTH).json()[0]["id"]
    for tags in ([""],[" "],["x"*65],["ok"]*21):
        resp=c.post("/api/v1/notes",headers=AUTH,json={
            "notebook_id":book,"title":"Bad tags","tags":tags
        })
        assert resp.status_code==422,(tags,resp.text)
    valid=c.post("/api/v1/notes",headers=AUTH,json={
        "notebook_id":book,"title":"Safe","tags":["  trimmed  ","safe"]
    })
    assert valid.status_code==201,valid.text
    assert valid.json()["tags"]==["trimmed","safe"]
    for tags in ([""],[" "],["x"*65]):
        resp=c.patch("/api/v1/notes/"+valid.json()["id"],headers=AUTH,json={
            "expected_version":1,"tags":tags
        })
        assert resp.status_code==422
    assert c.get("/api/v1/notes/"+valid.json()["id"],headers=AUTH).json()["version"]==1

"""Synthetic note library paging, backwards compatibility and bounds."""
import os
from uuid import uuid4

os.environ["GC_NOTEBOOK_TOKEN"]="test-only-32-characters-secret-0000"
from fastapi.testclient import TestClient
from notebook.main import create_app
from notebook.store import Store, now

def context(tmp_path):
    path=tmp_path/"paged.sqlite3"
    app=create_app(str(path),token=os.environ["GC_NOTEBOOK_TOKEN"])
    return TestClient(app),Store(str(path)),{"Authorization":"Bearer "+os.environ["GC_NOTEBOOK_TOKEN"]}

def seed(store,book,count):
    with store.connection() as db:
        entries=[(str(uuid4()),book,f"Note {i:04d}","body",now(),now()) for i in range(count)]
        db.executemany("""INSERT INTO notes (id,notebook_id,title,body,created_at,updated_at)
                       VALUES(?,?,?,?,?,?)""",entries)

def test_paging_beyond_existing_500_limit(tmp_path):
    client,store,auth=context(tmp_path)
    book=store.notebooks()[0]["id"]
    seed(store,book,535)
    old=client.get("/api/v1/notes",headers=auth)
    assert old.status_code==200 and len(old.json())==500
    first=client.get("/api/v1/notes/page",headers=auth,params={"limit":200,"offset":0})
    assert first.status_code==200,first.text
    p1=first.json()
    assert len(p1["results"])==200 and p1["next_offset"]==200 and p1["has_more"]
    second=client.get("/api/v1/notes/page",headers=auth,
                      params={"limit":500,"offset":200}).json()
    assert len(second["results"])==335 and second["next_offset"]==535
    assert not second["has_more"]
    assert len({n["id"] for n in p1["results"]+second["results"]})==535
    exhausted=client.get("/api/v1/notes/page",headers=auth,
                         params={"limit":200,"offset":535}).json()
    assert exhausted["results"]==[] and not exhausted["has_more"]
    assert exhausted["next_offset"]==535
    assert client.get("/api/v1/notes/page").status_code==401

def test_filters_trash_book_and_literal_percent_queries(tmp_path):
    client,store,auth=context(tmp_path)
    book=store.notebooks()[0]["id"]
    secondary=store.create_notebook("Second")["id"]
    first=store.create(book,"% literal")
    second=store.create(secondary,"Other","Contains underscore_")
    store.update(first["id"],{"deleted_at":now()},first["version"])
    visible=client.get("/api/v1/notes/page",headers=auth,params={"q":"%"}).json()
    assert visible["results"]==[]
    deleted=client.get("/api/v1/notes/page",headers=auth,
                       params={"q":"%","include_deleted":True,"notebook_id":book}).json()
    assert [n["id"] for n in deleted["results"]]==[first["id"]]
    other=client.get("/api/v1/notes/page",headers=auth,
                     params={"q":"_","notebook_id":secondary}).json()
    assert [n["id"] for n in other["results"]]==[second["id"]]

def test_rejects_invalid_paging_bounds(tmp_path):
    client,_,auth=context(tmp_path)
    for params in ({"limit":0},{"limit":501},{"offset":-1},{"offset":100001}):
        assert client.get("/api/v1/notes/page",headers=auth,params=params).status_code==422

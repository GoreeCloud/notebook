import os

os.environ["GC_NOTEBOOK_TOKEN"]="test-only-32-characters-secret-0000"
from fastapi.testclient import TestClient
from notebook.main import create_app
from notebook.store import Store

AUTH={"Authorization":"Bearer "+os.environ["GC_NOTEBOOK_TOKEN"]}


def fixture(tmp_path):
    return TestClient(create_app(str(tmp_path/"notes.sqlite3"),token=os.environ["GC_NOTEBOOK_TOKEN"]))


def note(c, book, title):
    r=c.post("/api/v1/notes",headers=AUTH,
             json={"notebook_id":book,"title":title,"body":"meteoric event"})
    assert r.status_code==201,r.text
    return r.json()


def search(c,book,offset=0,limit=50):
    return c.get("/api/v1/search",headers=AUTH,
                 params={"q":"meteor","notebook_id":book,
                         "offset":offset,"limit":limit})


def test_scope_before_pagination_even_when_other_notebook_has_many_matches(tmp_path):
    c=fixture(tmp_path)
    book1=c.get("/api/v1/notebooks",headers=AUTH).json()[0]["id"]
    book2=c.post("/api/v1/notebooks",headers=AUTH,
                 json={"name":"Other Notebook"}).json()["id"]
    for i in range(205):
        note(c,book2,"Unrelated collection "+str(i))
    target=note(c,book1,"Relevant private note")
    filtered=search(c,book1,limit=3)
    assert filtered.status_code==200
    result=filtered.json()
    assert result["backend"]=="fts5"
    assert result["has_more"] is False
    assert [n["id"] for n in result["results"]]==[target["id"]]
    assert search(c,book2,limit=20).json()["has_more"] is True
    assert search(c,book1,offset=1).json()["results"]==[]
    assert c.get("/api/v1/search",headers=AUTH,params={"q":"meteor"}).status_code==200
    assert search(c,"nonexistent").json()["results"]==[]


def test_like_fallback_respects_notebook_id(tmp_path):
    path=tmp_path/"fallback.sqlite3"
    db=Store(str(path))
    main=db.notebooks()[0]["id"]
    other=db.create_notebook("Other")["id"]
    wanted=db.create(main,"Meteor shower","report")
    db.create(other,"Meteor shower","other report")
    db.fts_enabled=False
    response=db.search_ranked("Meteor",limit=10,notebook_id=main)
    assert response["backend"]=="like"
    assert [n["id"] for n in response["results"]]==[wanted["id"]]

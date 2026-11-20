import os

os.environ["GC_NOTEBOOK_TOKEN"]="test-only-32-characters-secret-0000"
from fastapi.testclient import TestClient
from notebook.main import create_app
from notebook.store import Store

AUTH={"Authorization":"Bearer "+os.environ["GC_NOTEBOOK_TOKEN"]}


def client(tmp_path):
    return TestClient(create_app(str(tmp_path/"fts.sqlite3"),
                                 token=os.environ["GC_NOTEBOOK_TOKEN"]))


def note(c, title, body="", tags=None):
    book=c.get("/api/v1/notebooks",headers=AUTH).json()[0]["id"]
    result=c.post("/api/v1/notes",headers=AUTH,
                  json={"notebook_id":book,"title":title,
                        "body":body,"tags":tags or []})
    assert result.status_code==201,result.text
    return result.json()


def search(c,q,limit=50,offset=0):
    return c.get("/api/v1/search",headers=AUTH,
                 params={"q":q,"limit":limit,"offset":offset})


def test_ranked_search_body_tags_title_and_injection(tmp_path):
    c=client(tmp_path)
    title=note(c,"Orchid Roadmap","planning")
    tagged=note(c,"Garden","growing",["orchids"])
    body=note(c,"Third","Orchid growth notes")
    data=search(c,"orchid").json()
    assert data["backend"]=="fts5"
    assert data["results"][0]["id"]==title["id"]
    assert {r["id"] for r in data["results"]}=={title["id"],tagged["id"],body["id"]}
    assert search(c,'" OR * -- nonexistent').status_code==200
    assert search(c,'" OR * -- nonexistent').json()["results"]==[]


def test_edit_delete_restore_refresh_search_index(tmp_path):
    c=client(tmp_path)
    created=note(c,"Draft","cobalt")
    assert len(search(c,"cobalt").json()["results"])==1
    updated=c.patch("/api/v1/notes/"+created["id"],headers=AUTH,
                    json={"expected_version":1,"body":"emerald"}).json()
    assert search(c,"cobalt").json()["results"]==[]
    assert len(search(c,"emerald").json()["results"])==1
    deleted=c.request("DELETE","/api/v1/notes/"+created["id"],
                      headers=AUTH,json={"expected_version":2}).json()
    assert search(c,"emerald").json()["results"]==[]
    restored=c.post("/api/v1/notes/"+created["id"]+"/restore",
                    headers=AUTH,json={"expected_version":3}).json()
    assert len(search(c,"emerald").json()["results"])==1
    assert restored["version"]==4


def test_paginated_search_no_auth_and_validation(tmp_path):
    c=client(tmp_path)
    for i in range(5):
        note(c,"Journal entry "+str(i),"nostalgia")
    first=search(c,"nostal",limit=2).json()
    second=search(c,"nostal",limit=2,offset=2).json()
    third=search(c,"nostal",limit=2,offset=4).json()
    assert first["has_more"] is True
    assert second["has_more"] is True
    assert third["has_more"] is False
    assert len({r["id"] for page in [first,second,third] for r in page["results"]})==5
    assert c.get("/api/v1/search?q=nostal").status_code==401
    assert search(c,"",limit=1).status_code==422
    assert search(c,"nostal",limit=201).status_code==422


def test_old_database_rebuilds_index(tmp_path):
    path=tmp_path/"fts.sqlite3"
    db=Store(str(path))
    book=db.notebooks()[0]["id"]
    old=db.create(book,"Archived source","saltwater")
    # Simulate existing notes saved before the full-text feature landed.
    with db.connection() as conn:
        conn.executescript("""DROP TRIGGER notebook_fts_added;
            DROP TRIGGER notebook_fts_updated;
            DROP TRIGGER notebook_fts_removed;
            DROP TABLE notes_fts;""")
    c=client(tmp_path)
    result=search(c,"saltwat").json()
    assert len(result["results"])==1
    assert result["results"][0]["id"]==old["id"]


def test_import_notes_indexed_through_sql_triggers(tmp_path):
    c=client(tmp_path)
    book=c.get("/api/v1/notebooks",headers=AUTH).json()[0]
    doc=c.get("/api/v1/export",headers=AUTH).json()
    doc["notes"]=[{
        "id":"d773837c-26ab-4f55-9099-0194bb2da21a",
        "notebook_id":book["id"],"parent_id":None,
        "title":"Migration","body":"bioluminescence",
        "tags":[],"pinned":False,"deleted_at":None,"version":1,
        "created_at":"2026-11-20T12:00:00+00:00",
        "updated_at":"2026-11-20T12:00:00+00:00"
    }]
    result=c.post("/api/v1/import",headers=AUTH,
                  json={"document":doc,"dry_run":False})
    assert result.status_code==200,result.text
    assert len(search(c,"biolumines").json()["results"])==1

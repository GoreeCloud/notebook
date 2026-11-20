"""Authenticated local wiki-link graph tests on isolated SQLite databases."""
import os
import uuid

os.environ["GC_NOTEBOOK_TOKEN"]="test-only-32-characters-secret-0000"
from fastapi.testclient import TestClient
from notebook.main import create_app
from notebook.store import Store, now


def get_client(tmp_path):
    token=os.environ["GC_NOTEBOOK_TOKEN"]
    app=create_app(str(tmp_path/"graph.sqlite3"),token=token)
    return TestClient(app),{"Authorization":"Bearer "+token}


def post_note(client,auth,book,title,body=""):
    response=client.post("/api/v1/notes",headers=auth,
        json={"notebook_id":book,"title":title,"body":body})
    assert response.status_code==201,response.text
    return response.json()


def test_title_links_unique_per_notebook_and_id_links_are_stable(tmp_path):
    client,auth=get_client(tmp_path)
    book=client.get("/api/v1/notebooks",headers=auth).json()[0]["id"]
    other=client.post("/api/v1/notebooks",headers=auth,json={"name":"Other"}).json()["id"]
    target=post_note(client,auth,book,"Álpha")
    other_title=post_note(client,auth,other,"Álpha")
    by_title=post_note(client,auth,book,"Same book","read [[álPHA]] and [[Missing]]")
    by_other_book=post_note(client,auth,other,"Wrong context","[[Álpha]]")
    by_id=post_note(client,auth,other,"Stable reference",
        f"See [[note:{target['id']}|Readable label]] and [[note:{target['id']}]]")
    endpoint="/api/v1/notes/"+target["id"]
    response=client.get(endpoint+"/links",headers=auth)
    assert response.status_code==200,response.text
    result=response.json()
    assert {x["id"] for x in result["incoming"]["results"]}=={by_title["id"],by_id["id"]}
    assert result["outgoing"]["results"]==[]
    assert result["resolution"]=="unique-same-notebook-title-or-explicit-note-id"
    # A same-name second active target makes title notation ambiguous.
    dupe=post_note(client,auth,book,"ÁLPHA")
    result=client.get(endpoint+"/links",headers=auth).json()
    assert {x["id"] for x in result["incoming"]["results"]}=={by_id["id"]}
    # Explicit-ID links remain stable when a target is renamed.
    assert client.patch(endpoint,headers=auth,json={"expected_version":1,"title":"Renamed"}).status_code==200
    result=client.get(endpoint+"/links",headers=auth).json()
    assert {x["id"] for x in result["incoming"]["results"]}=={by_id["id"]}
    assert client.get(endpoint+"/links").status_code==401
    assert client.get("/api/v1/notes/bogus/links",headers=auth).status_code==404
    assert client.get(endpoint+"/links?limit=0",headers=auth).status_code==422


def test_outgoing_and_paginated_incoming_hide_trashed_notes(tmp_path):
    client,auth=get_client(tmp_path)
    book=client.get("/api/v1/notebooks",headers=auth).json()[0]["id"]
    a=post_note(client,auth,book,"A")
    b=post_note(client,auth,book,"B",f"[[note:{a['id']}]] [[A]]")
    c=post_note(client,auth,book,"C",f"[[note:{a['id']}]]")
    ref=post_note(client,auth,book,"Hub",f"[[note:{a['id']}]] [[B]] [[C]] [[note:broken]]")
    out=client.get("/api/v1/notes/"+ref["id"]+"/links",headers=auth).json()["outgoing"]
    assert [n["id"] for n in out["results"]]==[a["id"],b["id"],c["id"]]
    incoming=client.get("/api/v1/notes/"+a["id"]+"/links?limit=1",headers=auth).json()["incoming"]
    assert len(incoming["results"])==1 and incoming["has_more"]
    legacy=client.get("/api/v1/notes/"+a["id"]+"/backlinks",headers=auth).json()
    assert {x["id"] for x in legacy}=={b["id"],c["id"],ref["id"]}
    assert client.request("DELETE","/api/v1/notes/"+c["id"],headers=auth,
                          json={"expected_version":1}).status_code==200
    res=client.get("/api/v1/notes/"+a["id"]+"/links",headers=auth).json()
    assert {x["id"] for x in res["incoming"]["results"]}=={b["id"],ref["id"]}
    assert client.get("/api/v1/notes/"+c["id"]+"/links",headers=auth).status_code==404


def test_link_graph_scans_beyond_note_list_display_cap(tmp_path):
    client,auth=get_client(tmp_path)
    database=tmp_path/"graph.sqlite3"
    store=Store(str(database))
    book=store.notebooks()[0]["id"]
    target=store.create(book,"The Target")
    # SQL bulk seed is synthetic and stays confined to this temporary database.
    # The oldest matching source is deliberately outside list_notes' 500 cap.
    with store.connection() as db:
        rows=[(str(uuid.uuid4()),book,f"Filler {i}","","2026-11-20T00:00:00+00:00")
              for i in range(510)]
        rows.append((str(uuid.uuid4()),book,"Old linking note","[[The Target]]",
                     "2020-01-01T00:00:00+00:00"))
        db.executemany("""INSERT INTO notes
            (id,notebook_id,title,body,created_at,updated_at) VALUES(?,?,?,?,?,?)""",
            [(x[0],x[1],x[2],x[3],now(),x[4]) for x in rows])
    assert len(store.list_notes())==500
    response=client.get(f"/api/v1/notes/{target['id']}/backlinks",headers=auth)
    assert response.status_code==200,response.text
    assert [n["title"] for n in response.json()]==["Old linking note"]

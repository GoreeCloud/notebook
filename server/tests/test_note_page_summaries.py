"""Authenticated body-minimized local browsing, preserving full detail GET."""
import os

os.environ["GC_NOTEBOOK_TOKEN"]="test-only-32-characters-secret-0000"
from fastapi.testclient import TestClient
from notebook.main import create_app
from notebook.store import Store

AUTH={"Authorization":"Bearer "+os.environ["GC_NOTEBOOK_TOKEN"]}


def test_summary_metadata_and_full_note_hydration(tmp_path):
    path=tmp_path/"notes.sqlite3"
    store=Store(str(path))
    book=store.notebooks()[0]["id"]
    full_body="sensitive original body\n" + "x"*200_000
    note=store.create(book,"Long local note",full_body,tags=["private","library"])
    client=TestClient(create_app(str(path),token=os.environ["GC_NOTEBOOK_TOKEN"]))
    endpoint="/api/v1/notes/page?summary=true&limit=10"
    assert client.get(endpoint).status_code==401
    page=client.get(endpoint,headers=AUTH)
    assert page.status_code==200,page.text
    row=page.json()["results"][0]
    assert row["id"]==note["id"]
    assert "body" not in row
    assert row["tags"]==["private","library"]
    assert row["pinned"] is False
    assert row["preview"]==full_body[:160]
    assert "created_at" in row and "updated_at" in row
    assert len(page.content)<3000
    full=client.get("/api/v1/notes/"+note["id"],headers=AUTH).json()
    assert full["body"]==full_body
    legacy=client.get("/api/v1/notes/page?limit=10",headers=AUTH).json()
    assert legacy["results"][0]["body"]==full_body


def test_summary_search_and_trash_include_deleted(tmp_path):
    path=tmp_path/"notes.sqlite3"
    store=Store(str(path))
    book=store.notebooks()[0]["id"]
    active=store.create(book,"Work",body="body",tags=["accounting"])
    trashed=store.create(book,"Old note","body",tags=["archived"])
    store.update(trashed["id"],{"deleted_at":"2026-11-20T00:00:00Z"},1)
    client=TestClient(create_app(str(path),token=os.environ["GC_NOTEBOOK_TOKEN"]))
    active_page=client.get("/api/v1/notes/page",headers=AUTH,
                           params={"q":"Work","summary":"true"})
    assert [n["id"] for n in active_page.json()["results"]]==[active["id"]]
    all_page=client.get("/api/v1/notes/page",headers=AUTH,
                        params={"summary":True,"include_deleted":True})
    assert {n["id"] for n in all_page.json()["results"]}=={active["id"],trashed["id"]}
    assert all("body" not in item for item in all_page.json()["results"])
    assert client.get("/api/v1/notes/"+trashed["id"],headers=AUTH).status_code==404
    restored_preview=client.get("/api/v1/notes/"+trashed["id"],headers=AUTH,
                                params={"include_deleted":True})
    assert restored_preview.status_code==200
    assert restored_preview.json()["body"]=="body"
    assert restored_preview.json()["deleted_at"]
    assert client.get("/api/v1/notes/"+trashed["id"],
                      params={"include_deleted":True}).status_code==401
    assert client.get("/api/v1/notes/page",headers=AUTH,
                      params={"summary":"not-a-boolean"}).status_code==422

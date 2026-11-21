"""Authenticated body-minimized ranked search for FTS5 and LIKE fallback."""
import os

os.environ["GC_NOTEBOOK_TOKEN"]="test-only-32-characters-secret-0000"
from fastapi.testclient import TestClient
from notebook.main import create_app
from notebook.store import Store

AUTH={"Authorization":"Bearer "+os.environ["GC_NOTEBOOK_TOKEN"]}


def test_ranked_fts_search_summary_omits_unselected_full_body(tmp_path):
    path=tmp_path/"ranked.sqlite3"
    store=Store(str(path))
    book=store.notebooks()[0]["id"]
    secret="PRIVATE-SEARCH-LONG-CANARY "+("z"*250_000)+" meadowstone"
    note=store.create(book,"Searching",secret,tags=["research"])
    client=TestClient(create_app(str(path),token=os.environ["GC_NOTEBOOK_TOKEN"]))
    route="/api/v1/search?q=meadowstone&limit=10&summary=true"
    assert client.get(route).status_code==401
    response=client.get(route,headers=AUTH)
    assert response.status_code==200,response.text
    records=response.json()["results"]
    assert [x["id"] for x in records]==[note["id"]]
    assert "body" not in records[0]
    assert records[0]["preview"]==secret[:160]
    assert records[0]["tags"]==["research"]
    assert records[0]["pinned"] is False
    assert len(response.content)<2500
    legacy=client.get("/api/v1/search?q=meadowstone&limit=10",headers=AUTH)
    assert legacy.json()["results"][0]["body"]==secret
    full=client.get("/api/v1/notes/"+note["id"],headers=AUTH)
    assert full.json()["body"]==secret
    assert client.get("/api/v1/search?q=meadowstone&summary=invalid",
                      headers=AUTH).status_code==422


def test_ranked_search_summary_scopes_and_like_fallback(tmp_path):
    path=tmp_path/"scope.sqlite3"
    store=Store(str(path))
    book=store.notebooks()[0]["id"]
    other=store.create_notebook("Other")["id"]
    keep=store.create(book,"Comets","starlight"+("p"*1000),tags=["tag"])
    store.create(other,"Elsewhere","starlight")
    # Disabled FTS is an explicitly supported SQLite distribution fallback.
    store.fts_enabled=False
    page=store.search_ranked("starlight",limit=1,notebook_id=book,summary_only=True)
    assert page["backend"]=="like"
    assert [x["id"] for x in page["results"]]==[keep["id"]]
    assert "body" not in page["results"][0]
    assert len(page["results"][0]["preview"])==160
    assert page["results"][0]["tags"]==["tag"]
    all_results=store.search_ranked("starlight",limit=1,summary_only=True)
    assert all_results["has_more"] is True
    assert store.search_ranked("starlight",limit=1,offset=1,
                               summary_only=True)["has_more"] is False
    assert store.search_ranked("unmatched",summary_only=True)["results"]==[]

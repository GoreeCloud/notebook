"""Optional link-graph minimization and consistency under SQLite WAL writes."""
from contextlib import contextmanager
import os
import sqlite3

os.environ["GC_NOTEBOOK_TOKEN"]="test-only-32-characters-secret-0000"
from fastapi.testclient import TestClient
from notebook.main import create_app
from notebook.store import Store

AUTH={"Authorization":"Bearer "+os.environ["GC_NOTEBOOK_TOKEN"]}


def test_summary_link_graph_and_legacy_full_contract(tmp_path):
    path=tmp_path/"graph.sqlite3"
    store=Store(str(path))
    book=store.notebooks()[0]["id"]
    target=store.create(book,"A very long target","private-text-target-"+("t"*250_000))
    source=store.create(book,"Source","[[note:"+target["id"]+"]] "+("s"*250_000))
    api=TestClient(create_app(str(path),token=os.environ["GC_NOTEBOOK_TOKEN"]))
    endpoint="/api/v1/notes/"+source["id"]+"/links"
    assert api.get(endpoint,params={"summary":True}).status_code==401
    compact=api.get(endpoint,params={"summary":True},headers=AUTH)
    assert compact.status_code==200,compact.text
    outgoing=compact.json()["outgoing"]["results"]
    assert [x["id"] for x in outgoing]==[target["id"]]
    assert outgoing[0]["preview"].startswith("private-text-target-")
    assert "body" not in outgoing[0]
    assert outgoing[0]["tags"]==[]
    assert len(compact.content)<1500
    legacy=api.get(endpoint,headers=AUTH)
    assert legacy.status_code==200
    assert legacy.json()["outgoing"]["results"][0]["body"]==store.get(target["id"])["body"]
    incoming=api.get("/api/v1/notes/"+target["id"]+"/links",
                     params={"summary":True},headers=AUTH)
    rows=incoming.json()["incoming"]["results"]
    assert len(rows)==1 and rows[0]["id"]==source["id"]
    assert "body" not in rows[0] and len(rows[0]["preview"])==160
    assert api.get(endpoint,params={"summary":"invalid"},headers=AUTH).status_code==422


def test_graph_snapshot_preserves_consistent_reference_when_writer_trashes_target(tmp_path):
    path=tmp_path/"graph.sqlite3"
    primary=Store(str(path))
    book=primary.notebooks()[0]["id"]
    target=primary.create(book,"Destination","original body")
    source=primary.create(book,"Source",f"[[note:{target['id']}]]")
    with sqlite3.connect(path) as con:
        assert con.execute("PRAGMA journal_mode=WAL").fetchone()[0]=="wal"
    writer=Store(str(path))
    original_connection=primary.connection
    changed=[]
    @contextmanager
    def interleaved_read():
        with original_connection() as db:
            class Indexed:
                def __init__(self,cursor): self.cursor=cursor
                def __iter__(self):
                    yield from self.cursor
                    if not changed:
                        record=writer.get(target["id"])
                        writer.update(target["id"],{"deleted_at":"2026-11-20T23:00:00Z"},record["version"])
                        changed.append(True)
            class Connection:
                def execute(self,sql,args=()):
                    cursor=db.execute(sql,args)
                    if "SELECT id,notebook_id,title FROM notes" in sql:
                        return Indexed(cursor)
                    return cursor
            yield Connection()
    primary.connection=interleaved_read
    graph=primary.link_graph(source["id"],summary_only=True)
    primary.connection=original_connection
    assert changed
    assert [item["id"] for item in graph["outgoing"]["results"]]==[target["id"]]
    # A subsequent graph from a NEW read snapshot hides the trashed target.
    assert writer.link_graph(source["id"],summary_only=True)["outgoing"]["results"]==[]

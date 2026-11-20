import os

os.environ["GC_NOTEBOOK_TOKEN"] = "test-only-32-characters-secret-0000"
from fastapi.testclient import TestClient
from notebook.main import create_app
from notebook.store import Store

HEADERS = {"Authorization": "Bearer " + os.environ["GC_NOTEBOOK_TOKEN"]}


def client(path):
    return TestClient(create_app(str(path), token=os.environ["GC_NOTEBOOK_TOKEN"]))


def get(c, after=0, limit=100):
    return c.get("/api/v1/changes",headers=HEADERS,
                 params={"after_cursor":after,"limit":limit})


def test_create_update_trash_and_restore_cursors(tmp_path):
    c=client(tmp_path/"notes.sqlite3")
    notebook=c.get("/api/v1/notebooks",headers=HEADERS).json()[0]["id"]
    assert get(c).json()["events"]==[]
    note=c.post("/api/v1/notes",headers=HEADERS,
                json={"title":"Change one","notebook_id":notebook}).json()
    changed=c.patch("/api/v1/notes/"+note["id"],headers=HEADERS,
                    json={"expected_version":1,"body":"Changed"}).json()
    deleted=c.request("DELETE","/api/v1/notes/"+note["id"],headers=HEADERS,
                     json={"expected_version":2}).json()
    restored=c.post("/api/v1/notes/"+note["id"]+"/restore",headers=HEADERS,
                    json={"expected_version":3}).json()
    result=get(c).json()
    events=result["events"]
    assert [e["version"] for e in events]==[1,2,3,4]
    assert [e["cursor"] for e in events]==sorted(e["cursor"] for e in events)
    assert events[2]["deleted_at"] is not None
    assert events[3]["deleted_at"] is None
    assert result["has_more"] is False
    assert result["next_cursor"]==events[-1]["cursor"]
    assert get(c, after=result["next_cursor"]).json()["events"]==[]


def test_pagination_and_version_conflict_does_not_emit(tmp_path):
    c=client(tmp_path/"notes.sqlite3")
    book=c.get("/api/v1/notebooks",headers=HEADERS).json()[0]["id"]
    note=c.post("/api/v1/notes",headers=HEADERS,
                json={"notebook_id":book,"title":"Hello"}).json()
    bad=c.patch("/api/v1/notes/"+note["id"],headers=HEADERS,
                json={"expected_version":900,"title":"Wrong"})
    assert bad.status_code==409
    c.patch("/api/v1/notes/"+note["id"],headers=HEADERS,
            json={"expected_version":1,"title":"World"})
    page=get(c,limit=1).json()
    assert len(page["events"])==1 and page["has_more"] is True
    second=get(c,after=page["next_cursor"],limit=1).json()
    assert len(second["events"])==1 and second["has_more"] is False
    assert second["events"][0]["version"]==2
    assert get(c,after=-1).status_code==422
    assert get(c,limit=201).status_code==422
    assert c.get("/api/v1/changes").status_code==401


def test_preexisting_database_seeds_current_state_once(tmp_path):
    path=tmp_path/"legacy.sqlite3"
    store=Store(str(path))
    book=store.notebooks()[0]["id"]
    existing=store.create(book,"Already exists")
    # Mimic an existing pre-changefeed database by removing log/trigger schema.
    with store.connection() as db:
        db.executescript("""DROP TRIGGER notebook_note_added;
            DROP TRIGGER notebook_note_updated;
            DROP TABLE note_change_events;""")
    c=client(path)
    data=get(c).json()
    assert len(data["events"])==1
    assert data["events"][0]["note_id"]==existing["id"]
    again=client(path)
    assert len(get(again).json()["events"])==1


def test_bulk_json_import_automatically_emits_changes(tmp_path):
    c=client(tmp_path/"notes.sqlite3")
    before=c.get("/api/v1/export",headers=HEADERS).json()
    note_id="48a787d6-bd95-4205-99e8-d63f35d01900"
    before["notes"].append({
        "id":note_id,"notebook_id":before["notebooks"][0]["id"],
        "parent_id":None,"title":"Imported","body":"test","tags":[],
        "pinned":False,"deleted_at":None,"version":1,
        "created_at":"2026-11-20T10:00:00+00:00",
        "updated_at":"2026-11-20T10:00:00+00:00"
    })
    result=c.post("/api/v1/import",headers=HEADERS,
                  json={"document":before,"dry_run":False})
    assert result.status_code==200,result.text
    events=get(c).json()["events"]
    assert len(events)==1
    assert events[0]["note_id"]!=note_id  # Appended records get fresh UUIDs.
    assert events[0]["version"]==1

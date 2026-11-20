import os
from copy import deepcopy

os.environ["GC_NOTEBOOK_TOKEN"]="test-only-32-characters-secret-0000"
from fastapi.testclient import TestClient
from notebook.main import create_app


def fixture(tmp_path):
    return TestClient(create_app(str(tmp_path / "source.sqlite3"),
                                 token=os.environ["GC_NOTEBOOK_TOKEN"]))


def headers():
    return {"Authorization":"Bearer "+os.environ["GC_NOTEBOOK_TOKEN"]}


def get_archive(c):
    return c.get("/api/v1/export",headers=headers()).json()


def import_doc(c,doc,dry=True):
    return c.post("/api/v1/import",headers=headers(),
                  json={"document":doc,"dry_run":dry})


def sample(c):
    book=c.get("/api/v1/notebooks",headers=headers()).json()[0]
    note=c.post("/api/v1/notes",headers=headers(),
                json={"notebook_id":book["id"],"title":"Parent","body":"# Original",
                      "tags":["alpha"]}).json()
    child=c.post("/api/v1/notes",headers=headers(),
                 json={"notebook_id":book["id"],"parent_id":note["id"],
                       "title":"Child","body":"[[Parent]]"}).json()
    updated=c.patch("/api/v1/notes/"+note["id"],headers=headers(),
                    json={"expected_version":1,"body":"# Updated"}).json()
    c.request("DELETE","/api/v1/notes/"+child["id"],headers=headers(),
              json={"expected_version":1})
    return note,updated,child


def test_roundtrip_preserves_revisions_tags_trash_hierarchy(tmp_path):
    c=fixture(tmp_path)
    original,updated,child=sample(c)
    archive=get_archive(c)
    assert archive["format"]=="goreecloud-notebook-v2"
    assert len(archive["revisions"])==2  # edits + soft deletes
    before=len(archive["notes"])
    dry=import_doc(c,archive)
    assert dry.status_code==200
    assert dry.json()["dry_run"] is True
    assert len(get_archive(c)["notes"])==before
    applied=import_doc(c,archive,False)
    assert applied.status_code==200,applied.text
    assert applied.json()["notes"]==before
    new=get_archive(c)
    assert len(new["notes"])==before*2
    assert len(new["notebooks"])==2
    imported={n["id"]:n for n in new["notes"] if n["id"] not in {original["id"],child["id"]}}
    assert len(imported)==2
    imported_parent=next(n for n in imported.values() if n["title"]=="Parent")
    imported_child=next(n for n in imported.values() if n["title"]=="Child")
    assert imported_child["parent_id"]==imported_parent["id"]
    assert imported_child["deleted_at"] is not None
    assert imported_parent["body"]=="# Updated"
    assert imported_parent["tags"]==["alpha"]
    rev=[r for r in new["revisions"] if r["note_id"]==imported_parent["id"]]
    assert len(rev)==1 and rev[0]["body"]=="# Original"
    assert c.get("/api/v1/notes/"+imported_parent["id"],headers=headers()).status_code==200


def test_broken_archive_rejected_without_partial_writes(tmp_path):
    c=fixture(tmp_path)
    note,_,child=sample(c)
    original=get_archive(c)
    samples=[]
    changed=deepcopy(original)
    changed["notes"][1]["parent_id"]="not-a-uuid"
    samples.append(changed)
    changed=deepcopy(original)
    changed["notes"][0]["id"]=changed["notes"][1]["id"]
    samples.append(changed)
    changed=deepcopy(original)
    changed["notes"][0]["body"]="x"*1_000_001
    samples.append(changed)
    changed=deepcopy(original)
    changed["notes"][0]["parent_id"]=changed["notes"][1]["id"]
    changed["notes"][1]["parent_id"]=changed["notes"][0]["id"]
    samples.append(changed)
    changed=deepcopy(original)
    changed["notes"][0]["tags"]=["bad"]*21
    samples.append(changed)
    changed=deepcopy(original)
    changed["revisions"][0]["version"]=987654
    samples.append(changed)
    for candidate in samples:
        result=import_doc(c,candidate,False)
        assert result.status_code==422, result.text
        assert get_archive(c)==original


def test_malformed_format_and_auth(tmp_path):
    c=fixture(tmp_path)
    doc=get_archive(c)
    assert c.post("/api/v1/import",json={"document":doc}).status_code==401
    doc["format"]="notebook-import-unknown"
    assert import_doc(c,doc).status_code==422
    doc["format"]="goreecloud-notebook-v1"
    doc.pop("revisions")
    result=import_doc(c,doc)
    assert result.status_code==200 and result.json()["revisions"]==0

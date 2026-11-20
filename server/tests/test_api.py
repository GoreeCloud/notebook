import os
os.environ["GC_NOTEBOOK_TOKEN"] = "test-only-32-characters-secret-0000"

from fastapi.testclient import TestClient
from notebook.main import create_app


def client(tmp_path):
    return TestClient(create_app(str(tmp_path / "data.sqlite3"), token=os.environ["GC_NOTEBOOK_TOKEN"]))


def auth():
    return {"Authorization": "Bearer " + os.environ["GC_NOTEBOOK_TOKEN"]}


def test_authorization_and_empty_database(tmp_path):
    c = client(tmp_path)
    assert c.get("/health").status_code == 200
    assert c.get("/api/v1/notebooks").status_code == 401
    assert c.get("/api/v1/notebooks", headers=auth()).json()[0]["name"] == "My Notebook"


def test_tree_search_version_revisions_trash_restore_export(tmp_path):
    c = client(tmp_path)
    notebook_id = c.get("/api/v1/notebooks", headers=auth()).json()[0]["id"]
    res = c.post("/api/v1/notes", headers=auth(),
                 json={"notebook_id": notebook_id, "title": "Parent", "body": "hello world"})
    assert res.status_code == 201, res.text
    parent = res.json()
    child = c.post("/api/v1/notes", headers=auth(),
                   json={"notebook_id": notebook_id, "parent_id": parent["id"],
                         "title": "Child", "body": "a link to [[Parent]]"}).json()
    assert c.get("/api/v1/notes", headers=auth(), params={"q": "hello"}).json()[0]["id"] == parent["id"]
    assert c.get("/api/v1/notes/" + parent["id"] + "/backlinks", headers=auth()).json()[0]["id"] == child["id"]
    path = "/api/v1/notes/" + parent["id"]
    assert c.patch(path, headers=auth(), json={"expected_version": 1, "body": "updated"}).status_code == 200
    assert c.patch(path, headers=auth(), json={"expected_version": 1, "body": "stale"}).status_code == 409
    assert c.get(path + "/revisions", headers=auth()).json()[0]["body"] == "hello world"
    assert c.post(path + "/revisions/1/restore", headers=auth(), json={"expected_version": 2}).json()["body"] == "hello world"
    assert c.request("DELETE", path, headers=auth(), json={"expected_version": 3}).status_code == 200
    assert c.get(path, headers=auth()).status_code == 404
    assert c.post(path + "/restore", headers=auth(), json={"expected_version": 4}).status_code == 200
    assert len(c.get("/api/v1/export", headers=auth()).json()["notes"]) == 2


def test_reject_cycle_cross_notebook_invalid_payload(tmp_path):
    c = client(tmp_path)
    h = auth()
    notebook_id = c.get("/api/v1/notebooks", headers=h).json()[0]["id"]
    a = c.post("/api/v1/notes", headers=h, json={"notebook_id": notebook_id, "title": "A"}).json()
    b = c.post("/api/v1/notes", headers=h, json={"notebook_id": notebook_id,
               "title": "B", "parent_id": a["id"]}).json()
    assert c.patch("/api/v1/notes/" + a["id"], headers=h,
                   json={"expected_version": 1, "parent_id": b["id"]}).status_code == 409
    assert c.post("/api/v1/notes", headers=h,
                  json={"notebook_id": notebook_id, "title": ""}).status_code == 422
    other = c.post("/api/v1/notebooks", headers=h, json={"name":"Other"}).json()
    assert c.post("/api/v1/notes", headers=h, json={"notebook_id": other["id"],
                  "title": "Bad", "parent_id": a["id"]}).status_code == 409

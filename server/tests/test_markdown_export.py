import base64
import io
import os
import zipfile

os.environ["GC_NOTEBOOK_TOKEN"]="test-only-32-characters-secret-0000"
from fastapi.testclient import TestClient
from notebook.main import create_app

AUTH={"Authorization":"Bearer "+os.environ["GC_NOTEBOOK_TOKEN"]}


def client(tmp_path):
    return TestClient(create_app(str(tmp_path/"notes.sqlite3"),
                                 token=os.environ["GC_NOTEBOOK_TOKEN"]))


def notebook(c):
    return c.get("/api/v1/notebooks",headers=AUTH).json()[0]


def create(c,title,body,parent=None,tags=None,notebook_id=None):
    result=c.post("/api/v1/notes",headers=AUTH,json={
        "notebook_id":notebook_id or notebook(c)["id"],"title":title,
        "body":body,"parent_id":parent,"tags":tags or []})
    assert result.status_code==201,result.text
    return result.json()


def unzip(blob):
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        names=z.namelist()
        return {n:z.read(n).decode("utf-8") for n in names}


def test_markdown_zip_roundtrip_note_tree_exact_titles_and_bodies(tmp_path):
    c=client(tmp_path)
    parent=create(c,"Parent / journal","# Parent text\n",tags=["private"])
    child=create(c,"Child 🐧","**Bird**\n\nLine 2",parent=parent["id"])
    out=c.get("/api/v1/export/markdown-zip",headers=AUTH)
    assert out.status_code==200,out.text[:150] if out.status_code!=200 else ""
    assert out.headers["content-type"].startswith("application/zip")
    assert out.headers["cache-control"]=="no-store"
    assert 'filename="goreecloud-notebook-markdown.zip"' in out.headers["content-disposition"]
    files=unzip(out.content)
    assert len(files)==2
    assert all(name.endswith(".md") and not name.startswith("/") for name in files)
    payload={"archive_base64":base64.b64encode(out.content).decode("ascii"),
             "dry_run":True,"skip_unsupported":False}
    report=c.post("/api/v1/import/markdown-zip",headers=AUTH,json=payload)
    assert report.status_code==200,report.text
    assert report.json()["notes"]==2  # Matching parent directory uses the parent Markdown note.
    original_count=len(c.get("/api/v1/export",headers=AUTH).json()["notes"])
    payload["dry_run"]=False
    imported=c.post("/api/v1/import/markdown-zip",headers=AUTH,json=payload)
    assert imported.status_code==200,imported.text
    all_notes=c.get("/api/v1/export",headers=AUTH).json()["notes"]
    assert len(all_notes)==original_count+2
    new={n["title"]:n for n in all_notes if n["id"] not in {parent["id"],child["id"]}}
    assert set(new)=={"Parent / journal","Child 🐧"}
    assert new["Child 🐧"]["parent_id"]==new["Parent / journal"]["id"]
    assert new["Parent / journal"]["body"]=="# Parent text\n"
    assert new["Child 🐧"]["body"]=="**Bird**\n\nLine 2"
    assert new["Parent / journal"]["tags"]==[]  # Intentionally plaintext format, no tags.


def test_existing_plain_markdown_file_and_directory_are_same_parent(tmp_path):
    c=client(tmp_path)
    buffer=io.BytesIO()
    with zipfile.ZipFile(buffer,"w",zipfile.ZIP_DEFLATED) as z:
        z.writestr("Ideas.md","# Parent")
        z.writestr("Ideas/Next.md","child")
    payload={"archive_base64":base64.b64encode(buffer.getvalue()).decode(),
             "dry_run":False}
    result=c.post("/api/v1/import/markdown-zip",headers=AUTH,json=payload)
    assert result.status_code==200,result.text
    assert result.json()["notes"]==2
    items=c.get("/api/v1/export",headers=AUTH).json()["notes"]
    by_title={n["title"]:n for n in items}
    assert by_title["Next"]["parent_id"]==by_title["Ideas"]["id"]


def test_soft_deleted_notes_are_not_in_plaintext_export(tmp_path):
    c=client(tmp_path)
    active=create(c,"Keep","unredacted")
    trash=create(c,"Deleted","private")
    deleted=c.request("DELETE","/api/v1/notes/"+trash["id"],
                      headers=AUTH,json={"expected_version":1})
    assert deleted.status_code==200
    files=unzip(c.get("/api/v1/export/markdown-zip",headers=AUTH).content)
    assert len(files)==1
    assert "unredacted" in next(iter(files.values()))
    assert "private" not in next(iter(files.values()))


def test_multi_notebook_plaintext_export_separates_paths(tmp_path):
    c=client(tmp_path)
    one=notebook(c)
    other=c.post("/api/v1/notebooks",headers=AUTH,json={"name":"Planning"}).json()
    create(c,"Same name","A",notebook_id=one["id"])
    create(c,"Same name","B",notebook_id=other["id"])
    files=unzip(c.get("/api/v1/export/markdown-zip",headers=AUTH).content)
    assert len(files)==2
    assert len({key.split("/")[0] for key in files})==2


def test_empty_archive_and_unauthorized_access(tmp_path):
    c=client(tmp_path)
    assert c.get("/api/v1/export/markdown-zip").status_code==401
    result=c.get("/api/v1/export/markdown-zip",headers=AUTH)
    assert result.status_code==422
    assert "No active notes" in result.text

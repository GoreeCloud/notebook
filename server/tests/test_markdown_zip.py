import base64
import io
import os
import stat
import zipfile

os.environ["GC_NOTEBOOK_TOKEN"]="test-only-32-characters-secret-0000"
from fastapi.testclient import TestClient
from notebook.main import create_app

HEADERS={"Authorization":"Bearer "+os.environ["GC_NOTEBOOK_TOKEN"]}


def encode_zip(files, *, with_symlink=False):
    buf=io.BytesIO()
    with zipfile.ZipFile(buf,"w",zipfile.ZIP_DEFLATED) as z:
        for path,body in files.items():
            z.writestr(path,body)
        if with_symlink:
            item=zipfile.ZipInfo("link.md")
            item.create_system=3
            item.external_attr=(stat.S_IFLNK | 0o777) <<16
            z.writestr(item, "../secret")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def post(client, blob, *, dry=True, skip=False):
    return client.post("/api/v1/import/markdown-zip",headers=HEADERS,
                       json={"archive_base64":blob,"dry_run":dry,
                             "skip_unsupported":skip})


def archive(client):
    return client.get("/api/v1/export",headers=HEADERS).json()


def test_markdown_folder_roundtrip_and_dry_run(tmp_path):
    client=TestClient(create_app(str(tmp_path/"notes.sqlite3"), token=os.environ["GC_NOTEBOOK_TOKEN"]))
    blob=encode_zip({
        "Reading/Books/Favorites.md":"# Favorites\n - good book",
        "Reading/Queue.markdown":"Read next",
        "Root.md":"# Root document"
    })
    original=archive(client)
    preview=post(client,blob)
    assert preview.status_code==200,preview.text
    assert preview.json()["notes"]==5 # 3 Markdown + 2 folder placeholders
    assert archive(client)==original
    applied=post(client,blob,dry=False)
    assert applied.status_code==200,applied.text
    notes=archive(client)["notes"]
    by_title={n["title"]:n for n in notes}
    assert by_title["Books"]["parent_id"]==by_title["Reading"]["id"]
    assert by_title["Favorites"]["parent_id"]==by_title["Books"]["id"]
    assert by_title["Queue"]["parent_id"]==by_title["Reading"]["id"]
    assert by_title["Root"]["parent_id"] is None
    assert by_title["Favorites"]["body"].startswith("# Favorites")


def test_unsupported_media_and_trilium_metadata_consent(tmp_path):
    client=TestClient(create_app(str(tmp_path/"notes.sqlite3"), token=os.environ["GC_NOTEBOOK_TOKEN"]))
    blob=encode_zip({"Main.md":"# Text","meta.json":"{}","assets/pic.png":b"\x89PNG"})
    denied=post(client,blob,dry=False)
    assert denied.status_code==422
    assert "skip_unsupported" in denied.text
    assert archive(client)["notes"]==[]
    preview=post(client,blob,skip=True)
    assert preview.status_code==200
    assert "omitted" in " ".join(preview.json()["warnings"])
    assert post(client,blob,dry=False,skip=True).status_code==200
    assert archive(client)["notes"][0]["body"]=="# Text"


def test_reject_zip_slip_duplicate_names_and_symlink(tmp_path):
    client=TestClient(create_app(str(tmp_path/"notes.sqlite3"), token=os.environ["GC_NOTEBOOK_TOKEN"]))
    for files,symlink in (
        ({"../private.md":"oops"},False),
        ({"/absolute.md":"oops"},False),
        ({"a\\b.md":"oops"},False),
        ({"foo.md":"hi","FOO.md":"duplicate"},False),
        ({"a/./hidden.md":"bad"},False),
        ({"real.md":"okay"},True),
    ):
        result=post(client,encode_zip(files,with_symlink=symlink),dry=False)
        assert result.status_code==422,result.text
        assert archive(client)["notes"]==[]


def test_reject_large_uncompressed_zip_and_bad_encoding(tmp_path):
    client=TestClient(create_app(str(tmp_path/"notes.sqlite3"), token=os.environ["GC_NOTEBOOK_TOKEN"]))
    big=encode_zip({"a.md":"a"*1_000_001})
    assert post(client,big,dry=False).status_code==422
    assert post(client,"not-base64",dry=False).status_code==422
    invalid=encode_zip({"a.md":bytes([0xff,0xfe])})
    assert post(client,invalid,dry=False).status_code==422
    assert archive(client)["notes"]==[]


def test_no_token_no_import(tmp_path):
    client=TestClient(create_app(str(tmp_path/"notes.sqlite3"), token=os.environ["GC_NOTEBOOK_TOKEN"]))
    blob=encode_zip({"note.md":"Hello"})
    assert client.post("/api/v1/import/markdown-zip",
                       json={"archive_base64":blob,"dry_run":False}).status_code==401
    assert archive(client)["notes"]==[]

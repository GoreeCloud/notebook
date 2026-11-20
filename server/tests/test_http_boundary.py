import os
import stat

SECRET="test-only-32-characters-secret-0000"
os.environ["GC_NOTEBOOK_TOKEN"]=SECRET

import pytest
from fastapi.testclient import TestClient
from notebook.main import create_app
from notebook.http_boundary import MAX_REQUEST_BYTES
from notebook.store import Store

HEADERS={"Authorization":"Bearer "+SECRET}


def client(tmp_path):
    return TestClient(create_app(str(tmp_path/"api.sqlite3"), token=SECRET))


def test_private_db_creation_and_symlink_rejected(tmp_path):
    old=os.umask(0)
    try:
        private=tmp_path/"private/db.sqlite3"
        Store(str(private))
    finally:
        os.umask(old)
    assert private.exists()
    assert stat.S_IMODE(private.stat().st_mode)==0o600
    assert stat.S_IMODE(private.parent.stat().st_mode)==0o700
    symlink=tmp_path/"redirect.sqlite3"
    symlink.symlink_to(private)
    with pytest.raises(ValueError,match="symlinked"):
        Store(str(symlink))


def test_no_cache_security_headers_and_bearer_guard(tmp_path):
    c=client(tmp_path)
    unauthorized=c.get("/api/v1/export")
    assert unauthorized.status_code==401
    assert unauthorized.headers["cache-control"]=="no-store"
    assert unauthorized.headers["x-frame-options"]=="DENY"
    assert unauthorized.headers["x-content-type-options"]=="nosniff"
    assert unauthorized.headers["referrer-policy"]=="no-referrer"
    assert "default-src 'none'" in unauthorized.headers["content-security-policy"]
    authenticated=c.get("/api/v1/export",headers=HEADERS)
    assert authenticated.status_code==200
    assert authenticated.headers["cache-control"]=="no-store"
    assert authenticated.headers["pragma"]=="no-cache"


def test_reject_oversized_request_before_parsing(tmp_path):
    c=client(tmp_path)
    data=b"x"*(MAX_REQUEST_BYTES+1)
    response=c.post("/api/v1/notebooks",content=data,headers={
        **HEADERS,"Content-Type":"application/json"
    })
    assert response.status_code==413
    assert response.headers["cache-control"]=="no-store"
    assert c.get("/api/v1/notebooks",headers=HEADERS).status_code==200


def test_origin_fail_closed_for_remote_and_wildcard(tmp_path,monkeypatch):
    monkeypatch.setenv("GC_NOTEBOOK_ORIGINS","*")
    with pytest.raises(RuntimeError,match="Invalid"):
        create_app(str(tmp_path/"wildcard.sqlite3"),token=SECRET)
    monkeypatch.setenv("GC_NOTEBOOK_ORIGINS","https://evil.example")
    with pytest.raises(RuntimeError,match="Remote"):
        create_app(str(tmp_path/"remote.sqlite3"),token=SECRET)
    monkeypatch.setenv("GC_NOTEBOOK_ORIGINS","http://127.0.0.1:5173")
    c=TestClient(create_app(str(tmp_path/"local.sqlite3"),token=SECRET))
    response=c.options("/api/v1/notes",headers={
        "Origin":"http://127.0.0.1:5173",
        "Access-Control-Request-Method":"GET"
    })
    assert response.headers["access-control-allow-origin"]=="http://127.0.0.1:5173"


def test_bad_auth_does_not_reveal_secret(tmp_path):
    c=client(tmp_path)
    response=c.get("/api/v1/notes",headers={"Authorization":"Bearer guessed"})
    assert response.status_code==401
    assert SECRET not in response.text


def test_streamed_body_without_content_length_is_bounded(tmp_path):
    c=client(tmp_path)
    def chunks():
        yield b"x"* (6*1024*1024)
        yield b"y"* (6*1024*1024+1)
    result=c.post("/api/v1/notebooks",content=chunks(),
                  headers={**HEADERS,"Content-Type":"application/json"})
    assert result.status_code==413
    assert result.headers["cache-control"]=="no-store"

"""REST API with bearer authentication and loopback-oriented defaults."""
from __future__ import annotations

import os
import secrets
from pathlib import Path
from urllib.parse import urlsplit
from typing import Annotated, Any

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, StringConstraints

from .store import Conflict, NotFound, Store, now
from .transfer import InvalidArchive, export_all, import_archive
from .enex import parse_enex
from .http_boundary import LocalApiBoundary
from .markdown_zip import parse_markdown_zip
from .markdown_export import make_markdown_zip


class NotebookCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class NoteCreate(BaseModel):
    notebook_id: str
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(default="", max_length=1_000_000)
    parent_id: str | None = None
    tags: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]] = Field(default_factory=list, max_length=20)


class NotePatch(BaseModel):
    expected_version: int = Field(ge=1)
    notebook_id: str | None = None
    parent_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = Field(default=None, max_length=1_000_000)
    tags: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]] | None = Field(default=None, max_length=20)
    pinned: bool | None = None


class MarkdownZipRequest(BaseModel):
    archive_base64: str = Field(min_length=1, max_length=11_200_000)
    dry_run: bool = True
    skip_unsupported: bool = False


class EnexImportRequest(BaseModel):
    xml: str = Field(min_length=1, max_length=8 * 1024 * 1024)
    dry_run: bool = True
    skip_resources: bool = False


class ImportRequest(BaseModel):
    document: dict[str, Any]
    dry_run: bool = True


class VersionCheck(BaseModel):
    expected_version: int = Field(ge=1)


def create_app(db_path: str | None = None, token: str | None = None) -> FastAPI:
    secret = token if token is not None else os.environ.get("GC_NOTEBOOK_TOKEN", "")
    if len(secret) < 24:
        raise RuntimeError("Set GC_NOTEBOOK_TOKEN to a random value of at least 24 characters")
    path = db_path or os.environ.get(
        "GC_NOTEBOOK_DB", str(Path.home() / ".local/share/goreecloud/notebook/notes.sqlite3"))
    store = Store(path)
    app = FastAPI(title="GoreeCloud Notebook", version="0.1.0", docs_url=None, redoc_url=None)
    origins = [o.strip() for o in os.environ.get(
        "GC_NOTEBOOK_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",") if o.strip()]
    # A bearer token is temporary local-development auth, not Identity.
    # Prevent accidental wildcard or remote browser origins by default.
    for origin in origins:
        parsed = urlsplit(origin)
        if not parsed.scheme in ("http", "https") or not parsed.hostname or (
            parsed.path not in ("", "/") or parsed.username or parsed.password or
            parsed.query or parsed.fragment or parsed.netloc != parsed.netloc.strip()
        ):
            raise RuntimeError("Invalid GC_NOTEBOOK_ORIGINS entry")
        if (parsed.hostname not in ("localhost", "127.0.0.1", "::1") and
                os.environ.get("GC_NOTEBOOK_ALLOW_REMOTE_ORIGINS") != "1"):
            raise RuntimeError(
                "Remote CORS origins require explicit GC_NOTEBOOK_ALLOW_REMOTE_ORIGINS=1"
            )
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET","POST","PATCH","DELETE"],
                       allow_headers=["Authorization","Content-Type"], allow_credentials=False)
    app.add_middleware(LocalApiBoundary)

    def authorize(authorization: Annotated[str | None, Header()] = None):
        if not authorization or not authorization.startswith("Bearer ") or not secrets.compare_digest(
            authorization[7:], secret
        ):
            raise HTTPException(status_code=401, detail="Valid bearer token required")

    def safe(call, *args, **kwargs):
        try:
            return call(*args, **kwargs)
        except NotFound as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
        except Conflict as e:
            raise HTTPException(status_code=409, detail=str(e)) from e
        except InvalidArchive as e:
            raise HTTPException(status_code=422, detail=str(e)) from e

    @app.get("/health")
    def health():
        return {"ok": True, "service": "goreecloud-notebook"}

    api = APIRouter(prefix="/api/v1", dependencies=[Depends(authorize)])

    @api.get("/notebooks")
    def notebooks():
        return store.notebooks()

    @api.post("/notebooks", status_code=201)
    def new_notebook(payload: NotebookCreate):
        return store.create_notebook(payload.name.strip())

    @api.get("/notes")
    def notes(notebook_id: str | None = None, q: str = Query(default="", max_length=200),
              include_deleted: bool = False):
        return store.list_notes(notebook_id, q, include_deleted)

    @api.get("/notes/page")
    def notes_page(notebook_id: str | None = None,
                   q: str = Query(default="", max_length=200),
                   include_deleted: bool = False,
                   limit: int = Query(default=200, ge=1, le=500),
                   offset: int = Query(default=0, ge=0, le=100000),
                   summary: bool = False):
        return store.list_notes_page(notebook_id=notebook_id, q=q,
                                     include_deleted=include_deleted,
                                     limit=limit, offset=offset,
                                     summary_only=summary)

    @api.post("/notes", status_code=201)
    def new_note(payload: NoteCreate):
        return safe(store.create, payload.notebook_id, payload.title.strip(),
                    payload.body, payload.parent_id, payload.tags)

    @api.get("/notes/{note_id}")
    def get_note(note_id: str, include_deleted: bool = False):
        # Trash can be inspected only when explicitly requested.
        # Existing callers still hide deleted notes by default.
        return safe(store.get, note_id, include_deleted=include_deleted)

    @api.patch("/notes/{note_id}")
    def update_note(note_id: str, payload: NotePatch):
        changes = payload.model_dump(exclude_unset=True, exclude={"expected_version"})
        if any(changes.get(k) is None for k in ("title", "body", "notebook_id", "tags", "pinned") if k in changes):
            raise HTTPException(status_code=422, detail="Non-null value required")
        return safe(store.update, note_id, changes, payload.expected_version)

    @api.delete("/notes/{note_id}")
    def trash_note(note_id: str, payload: VersionCheck):
        return safe(store.update, note_id, {"deleted_at": now()}, payload.expected_version)

    @api.post("/notes/{note_id}/restore")
    def untrash_note(note_id: str, payload: VersionCheck):
        return safe(store.update, note_id, {"deleted_at": None}, payload.expected_version)

    @api.get("/notes/{note_id}/revisions")
    def revisions(note_id: str):
        return safe(store.revisions, note_id)

    @api.post("/notes/{note_id}/revisions/{version}/restore")
    def restore_revision(note_id: str, version: int, payload: VersionCheck):
        return safe(store.restore_revision, note_id, version, payload.expected_version)

    @api.get("/notes/{note_id}/backlinks")
    def backlinks(note_id: str, limit: int = Query(default=100, ge=1, le=100),
                  offset: int = Query(default=0, ge=0, le=10000)):
        return safe(store.backlinks, note_id, limit, offset)

    @api.get("/notes/{note_id}/links")
    def note_link_graph(note_id: str, limit: int = Query(default=50, ge=1, le=100),
                        offset: int = Query(default=0, ge=0, le=10000)):
        return safe(store.link_graph, note_id, limit, offset)

    @api.get("/search")
    def ranked_search(q: str = Query(min_length=1, max_length=200),
                      limit: int = Query(default=50, ge=1, le=200),
                      offset: int = Query(default=0, ge=0, le=5000),
                      notebook_id: str | None = Query(default=None, max_length=60)):
        return store.search_ranked(q, limit, offset, notebook_id)

    @api.get("/changes")
    def local_changes(after_cursor: int = Query(default=0, ge=0),
                      limit: int = Query(default=100, ge=1, le=200)):
        return store.changes(after_cursor, limit)

    @api.get("/export/markdown-zip")
    def export_markdown_zip():
        data = safe(make_markdown_zip, store)
        return Response(
            content=data,
            media_type="application/zip",
            headers={"Content-Disposition":
                     'attachment; filename="goreecloud-notebook-markdown.zip"'},
        )

    @api.get("/export")
    def export():
        return safe(export_all, store)

    @api.post("/import")
    def import_notes(payload: ImportRequest):
        return safe(import_archive, store, payload.document, payload.dry_run)

    @api.post("/import/enex")
    def import_enex(payload: EnexImportRequest):
        document, warnings = safe(parse_enex, payload.xml,
                                  skip_resources=payload.skip_resources)
        result = safe(import_archive, store, document, payload.dry_run)
        result["warnings"].extend(warnings)
        return result

    @api.post("/import/markdown-zip")
    def import_markdown_zip(payload: MarkdownZipRequest):
        document, warnings = safe(parse_markdown_zip, payload.archive_base64,
                                  skip_unsupported=payload.skip_unsupported)
        result = safe(import_archive, store, document, payload.dry_run)
        result["warnings"].extend(warnings)
        return result

    app.include_router(api)
    return app


# Uvicorn imports this module with GC_NOTEBOOK_TOKEN set in the environment.
app = create_app()

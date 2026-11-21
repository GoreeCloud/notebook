"""Source-level constraints; rootless Podman smoke is separate and opt-in."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]


def test_preview_container_is_nonroot_and_digest_pinned():
    dockerfile=(ROOT/"Containerfile").read_text()
    assert "FROM docker.io/library/python:3.12.16-slim-bookworm@sha256:" in dockerfile
    assert "USER 10001:10001" in dockerfile
    assert "GC_NOTEBOOK_DB=/data/notes.sqlite3" in dockerfile
    assert "server/notebook/ ./notebook/" in dockerfile
    assert "COPY . " not in dockerfile
    assert "GC_NOTEBOOK_TOKEN=" not in dockerfile
    assert "--no-access-log" in dockerfile


def test_compose_requires_private_token_and_publishes_loopback_only():
    compose=(ROOT/"compose.yaml").read_text()
    assert '"127.0.0.1:8000:8000"' in compose
    assert "GC_NOTEBOOK_TOKEN: " in compose
    assert "GC_NOTEBOOK_TOKEN: \""+chr(36)+"{GC_NOTEBOOK_TOKEN:?" in compose
    assert "read_only: true" in compose
    assert "no-new-privileges:true" in compose
    assert "cap_drop:" in compose and "ALL" in compose
    assert "notebook-dev-data:/data" in compose
    assert "restart: \"no\"" in compose


def test_build_context_excludes_secrets_and_normal_profiles():
    ignore=(ROOT/".dockerignore").read_text()
    for item in [".env","*.sqlite3","*.db","*.gcnb",".git",".venv"]:
        assert item in ignore
    smoke=(ROOT/"scripts/smoke_container_preview.sh").read_text()
    assert "--publish 127.0.0.1::8000" in smoke
    assert "podman volume rm" in smoke
    assert "podman rm -f" in smoke
    assert '--env GC_NOTEBOOK_TOKEN' in smoke
    assert '--env GC_NOTEBOOK_TOKEN=' not in smoke

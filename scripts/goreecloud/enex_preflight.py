#!/usr/bin/env python3
"""Read-only ENEX structure preflight for a GoreeCloud Notebook migration.

This does NOT import notes or assert compatibility with the inherited Trilium
importer. Only anonymous aggregate counts are emitted; no note text or filenames
are printed. This tool does not contact any network service or write source data.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys
from xml.parsers import expat


class EnexValidationError(ValueError):
    """Input was not a safe, supported Evernote export structure."""

# ENEX resource MIME is untrusted text. Output only known public labels.
PUBLIC_MIMES = frozenset({
    "application/octet-stream", "application/pdf", "application/zip",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "image/heic", "image/heif", "image/tiff", "image/bmp", "image/svg+xml",
    "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav",
    "video/mp4", "video/webm", "text/plain", "text/html",
})


def public_mime(raw: str) -> str:
    normalized = raw.strip().lower()
    if not normalized:
        return "unspecified"
    return normalized if normalized in PUBLIC_MIMES else "other/unknown"



def inspect_enex(path: Path, max_bytes: int = 200 * 1024 * 1024) -> dict:
    """Safely stream an ENEX file and return non-identifying aggregate metadata."""
    size = path.stat().st_size
    if not 0 < size <= max_bytes:
        raise EnexValidationError("ENEX is empty or exceeds the configured size limit")

    parser = expat.ParserCreate()
    path_stack: list[str] = []
    counts = Counter()
    mime_counts = Counter()
    unique_notes: set[bytes] = set()
    current_note: dict[str, str] | None = None
    captured: list[str] = []
    captured_field: str | None = None
    root_seen = False
    max_depth = 64

    def local(name: str) -> str:
        return name.rsplit(":", 1)[-1]

    def prohibit_doctype(*_: object) -> None:
        raise EnexValidationError("DTD declarations and entities are not allowed")

    def start(name: str, _attrs: dict[str, str]) -> None:
        nonlocal current_note, root_seen, captured_field, captured
        tag = local(name)
        if len(path_stack) >= max_depth:
            raise EnexValidationError("XML nesting is too deep")
        if not path_stack:
            if tag != "en-export":
                raise EnexValidationError("Expected an Evernote en-export root element")
            root_seen = True
        path_stack.append(tag)
        if len(path_stack) == 2 and tag == "note":
            current_note = {}
            counts["notes"] += 1
            if counts["notes"] > 1_000_000:
                raise EnexValidationError("Too many notes")
        if current_note is not None:
            if len(path_stack) == 3 and tag == "tag":
                counts["tags"] += 1
            elif len(path_stack) == 3 and tag == "resource":
                counts["resources"] += 1
        if (
            current_note is not None
            and len(path_stack) == 3 and tag in {"title", "created"}
        ) or (
            current_note is not None
            and len(path_stack) == 4 and tag == "mime"
            and path_stack[-2] == "resource"
        ):
            captured_field = tag
            captured = []

    def data(value: str) -> None:
        # Never retain <content> or base64 <data> bodies.
        if captured_field and sum(map(len, captured)) < 4096:
            captured.append(value[:4096])

    def end(name: str) -> None:
        nonlocal current_note, captured_field, captured
        tag = local(name)
        if not path_stack or path_stack[-1] != tag:
            raise EnexValidationError("Mismatched ENEX elements")
        if captured_field == tag:
            value = "".join(captured)[:4096].strip()
            if tag == "mime":
                mime_counts[public_mime(value)] += 1
            elif current_note is not None:
                current_note[tag] = value
            captured_field = None
            captured = []
        if len(path_stack) == 2 and tag == "note" and current_note is not None:
            # A title+creation-time match is a hint, not proof of duplication.
            key = (current_note.get("title", "") + "\x00" +
                   current_note.get("created", "")).encode("utf-8")
            digest = hashlib.sha256(key).digest()
            if digest in unique_notes:
                counts["possible_duplicates"] += 1
            else:
                unique_notes.add(digest)
            current_note = None
        path_stack.pop()

    parser.StartElementHandler = start
    parser.EndElementHandler = end
    parser.CharacterDataHandler = data
    parser.StartDoctypeDeclHandler = prohibit_doctype
    parser.EntityDeclHandler = prohibit_doctype
    parser.ExternalEntityRefHandler = lambda *_: prohibit_doctype()
    parser.SetParamEntityParsing(expat.XML_PARAM_ENTITY_PARSING_NEVER)

    try:
        with path.open("rb") as stream:
            while chunk := stream.read(64 * 1024):
                parser.Parse(chunk, False)
            parser.Parse(b"", True)
    except expat.ExpatError as exc:
        raise EnexValidationError("Malformed XML export") from exc
    if not root_seen or path_stack:
        raise EnexValidationError("Incomplete Evernote export")
    return {
        "format": "ENEX",
        "file_bytes": size,
        "notes": counts["notes"],
        "resources": counts["resources"],
        "tag_instances": counts["tags"],
        "possible_duplicate_title_date": counts["possible_duplicates"],
        "resource_mime_counts": dict(sorted(mime_counts.items())),
        "mode": "read-only-preflight",
        "warning": "Counts do not establish import compatibility, fidelity, or safe database migration",
    }


def main(argv: list[str] | None = None) -> int:
    command = argparse.ArgumentParser(description=__doc__)
    command.add_argument("file", type=Path, help="Local Evernote .enex export")
    command.add_argument("--max-mib", type=int, default=200,
                         help="Maximum accepted file size in MiB (default 200)")
    args = command.parse_args(argv)
    if args.max_mib < 1 or args.max_mib > 2048:
        command.error("--max-mib must be between 1 and 2048")
    try:
        result = inspect_enex(args.file, args.max_mib * 1024 * 1024)
    except (EnexValidationError, OSError) as exc:
        print(f"ENEX preflight failed: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Read-only, bounded local wiki-link graph; no remote link crawling or tracking.

Supported syntax:
  [[Exact Note Title]] resolves only in the source notebook if unique.
  [[note:<UUID>]] or [[note:<UUID>|Label]] links by immutable note ID.
Titles are never resolved ambiguously; stable-ID links may cross notebooks.
"""
from __future__ import annotations

import re
from collections import defaultdict
from uuid import UUID

from .store import NotFound

MARKUP = re.compile(r"\[\[([^\[\]\r\n]{1,200})\]\]")


def _resolve(body: str, source_notebook: str,
             ids: dict[str, dict], titles: dict[tuple[str,str],list[str]]) -> list[str]:
    result=[]
    seen=set()
    for match in MARKUP.finditer(body):
        content=match.group(1).strip()
        if not content:
            continue
        if content.lower().startswith("note:"):
            ident=content[5:].split("|",1)[0].strip()
            try:
                candidate=str(UUID(ident))
            except ValueError:
                continue
            if candidate not in ids:
                continue
        else:
            targets=titles.get((source_notebook,content.casefold()),[])
            # Duplicate title links are ambiguous; use stable-ID notation.
            if len(targets)!=1:
                continue
            candidate=targets[0]
        if candidate not in seen:
            seen.add(candidate)
            result.append(candidate)
    return result


def link_graph(store, note_id: str, *, limit: int=50, offset: int=0) -> dict:
    if not 1<=limit<=100 or not 0<=offset<=10000:
        raise ValueError("Invalid link page")
    with store.connection() as db:
        target=db.execute("SELECT * FROM notes WHERE id=? AND deleted_at IS NULL",
                          (note_id,)).fetchone()
        if target is None:
            raise NotFound("Note not found")
        metadata=[dict(item) for item in db.execute(
            "SELECT id,notebook_id,title FROM notes WHERE deleted_at IS NULL")]
        ids={item["id"]:item for item in metadata}
        titles=defaultdict(list)
        for item in metadata:
            titles[(item["notebook_id"],item["title"].casefold())].append(item["id"])
        direct=[ident for ident in _resolve(target["body"],target["notebook_id"],
                                           ids,titles) if ident!=note_id]
        outgoing_more=len(direct)>offset+limit
        outgoing=[]
        for ident in direct[offset:offset+limit]:
            row=db.execute("SELECT * FROM notes WHERE id=? AND deleted_at IS NULL",
                           (ident,)).fetchone()
            if row is not None:
                outgoing.append(store.note(row))
        incoming=[]
        matched=0
        incoming_more=False
        # SQL-level prefilter avoids parsing every non-link body in large stores.
        # Iterate full corpus rather than list_notes' 500-record display cap.
        for source in db.execute("""
            SELECT * FROM notes
            WHERE id<>? AND deleted_at IS NULL AND instr(body, '[[')>0
            ORDER BY updated_at DESC, id""",(note_id,)):
            linked=_resolve(source["body"],source["notebook_id"],ids,titles)
            if note_id not in linked:
                continue
            matched+=1
            if matched<=offset:
                continue
            if len(incoming)<limit:
                incoming.append(store.note(source))
            else:
                incoming_more=True
                break
    return {
        "incoming":{"results":incoming,"has_more":incoming_more},
        "outgoing":{"results":outgoing,"has_more":outgoing_more},
        "limit":limit,"offset":offset,
        "resolution":"unique-same-notebook-title-or-explicit-note-id",
    }

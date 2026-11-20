# API v1

All `/api/v1/*` paths require a bearer token in the Authorization header. `GET /health` is public.

| Endpoint | Methods | Behavior |
| --- | --- | --- |
| `/api/v1/notebooks` | GET, POST | List/create notebooks |
| `/api/v1/notes` | GET, POST | List/search and create; optional q, notebook_id, include_deleted |
| `/api/v1/notes/{id}` | GET, PATCH, DELETE | Fetch (optional include_deleted=true for explicit Trash detail), update, soft-delete |
| `/api/v1/notes/page` | GET | SQL-paginated notes; optional summary=true returns only a bounded text preview plus metadata |
| `/api/v1/notes/{id}/links` | GET | Bounded incoming/outgoing active wiki-link graph, including stable UUID links |
| `/api/v1/notes/{id}/restore` | POST | Restore from trash |
| `/api/v1/notes/{id}/revisions` | GET | List previous versions |
| `/api/v1/notes/{id}/revisions/{n}/restore` | POST | Restore prior body/title |
| `/api/v1/notes/{id}/backlinks` | GET | Match [[Note Title]] links |
| `/api/v1/search` | GET | Authenticated ranked title/body/tag FTS5 search, optional `notebook_id`, paginated prefix matches |
| `/api/v1/changes` | GET | Authenticated local mutation cursor, `after_cursor`, `limit` pagination; **not** Mesh sync |
| `/api/v1/export/markdown-zip` | GET | Authenticated, plaintext Markdown ZIP export of active note trees; **no** tags, revisions or Trash |
| `/api/v1/export` | GET | Export portable v2 JSON with revisions |
| `/api/v1/import` | POST | Validate or append archive; requires `{document,dry_run}` JSON |
| `/api/v1/import/enex` | POST | ENEX text, dates and tags import; requires `{xml,dry_run,skip_resources}` JSON |
| `/api/v1/import/markdown-zip` | POST | Validated Markdown ZIP import; requires `{archive_base64,dry_run,skip_unsupported}` JSON |

PATCH/DELETE/restore require `expected_version`; out-of-date edits return HTTP 409. All changes are transactional. Use `dry_run=true` before `dry_run=false`; imports remap all record IDs, preserve parent links, and never overwrite existing data. Supports v1 and v2 archive formats with a maximum serialized size of 8 MiB. Treat export content as private.

The local API enforces a 12 MiB streamed HTTP request limit and adds no-store headers on notebook endpoints. Browser origins default to loopback and remote origins require an explicit unsafe development opt-in; see [Local API Security](LOCAL_API_SECURITY.md).

## Hierarchy and input integrity

Changing a parent's `notebook_id` returns HTTP 409 while that note still has any child records, including trashed children. Move the children individually or remove their parent links before moving the parent; this prevents silent cross-notebook references. A note in Trash must be restored before its title/body/tags/pin can be modified. Existing behavior of trashing a parent without cascading deletion of its children is retained. Changes are guarded by `expected_version` and SQLite version checks. Tag items must be 1-64 characters after trimming (maximum 20 tags).

## Paged local notes (opt-in)

`GET /api/v1/notes/page` is a protected note-list envelope with `results`, `has_more`, `offset`, `next_offset` and `limit`. It accepts the same notebook/query/Trash filters as the existing array endpoint, with `limit=1..500` and `offset=0..100000`. Existing `GET /notes` continues to return a legacy array of at most 500 records. See [Note Pagination](NOTE_PAGINATION.md) for consistency and validation limits.


The optional GET /api/v1/notes/page?summary=true query returns a 160-character
preview plus safe note-list metadata, without exposing complete Markdown for
unselected notes. The default page response shape and legacy /notes array are
unchanged. Web editors explicitly hydrate the selected full note through
GET /api/v1/notes/{id} before editing; Trash uses include_deleted=true.
See [Note Pagination](NOTE_PAGINATION.md). Requests still require the local
bearer token; this does not implement Identity or GoreeShield policy.

The authenticated note-links endpoint supports optional summary=true,
which returns 160-character previews and note metadata in place of
full incoming/outgoing note bodies, without changing the default response.
The web app hydrates linked destinations through GET /notes/{id} before
editing. See [Local Links](LINKS.md).

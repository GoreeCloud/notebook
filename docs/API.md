# API v1

All `/api/v1/*` paths require a bearer token in the Authorization header. `GET /health` is public.

| Endpoint | Methods | Behavior |
| --- | --- | --- |
| `/api/v1/notebooks` | GET, POST | List/create notebooks |
| `/api/v1/notes` | GET, POST | List/search and create; optional q, notebook_id, include_deleted |
| `/api/v1/notes/{id}` | GET, PATCH, DELETE | Fetch, update, soft-delete |
| `/api/v1/notes/{id}/restore` | POST | Restore from trash |
| `/api/v1/notes/{id}/revisions` | GET | List previous versions |
| `/api/v1/notes/{id}/revisions/{n}/restore` | POST | Restore prior body/title |
| `/api/v1/notes/{id}/backlinks` | GET | Match [[Note Title]] links |
| `/api/v1/export` | GET | Export portable v2 JSON with revisions |
| `/api/v1/import` | POST | Validate or append archive; requires `{document,dry_run}` JSON |

PATCH/DELETE/restore require `expected_version`; out-of-date edits return HTTP 409. All changes are transactional. Use `dry_run=true` before `dry_run=false`; imports remap all record IDs, preserve parent links, and never overwrite existing data. Supports v1 and v2 archive formats with a maximum serialized size of 8 MiB. Treat export content as private.

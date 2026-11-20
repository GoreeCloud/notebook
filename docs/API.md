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
| `/api/v1/search` | GET | Authenticated ranked title/body/tag FTS5 search, optional `notebook_id`, paginated prefix matches |
| `/api/v1/changes` | GET | Authenticated local mutation cursor, `after_cursor`, `limit` pagination; **not** Mesh sync |
| `/api/v1/export/markdown-zip` | GET | Authenticated, plaintext Markdown ZIP export of active note trees; **no** tags, revisions or Trash |
| `/api/v1/export` | GET | Export portable v2 JSON with revisions |
| `/api/v1/import` | POST | Validate or append archive; requires `{document,dry_run}` JSON |
| `/api/v1/import/enex` | POST | ENEX text, dates and tags import; requires `{xml,dry_run,skip_resources}` JSON |
| `/api/v1/import/markdown-zip` | POST | Validated Markdown ZIP import; requires `{archive_base64,dry_run,skip_unsupported}` JSON |

PATCH/DELETE/restore require `expected_version`; out-of-date edits return HTTP 409. All changes are transactional. Use `dry_run=true` before `dry_run=false`; imports remap all record IDs, preserve parent links, and never overwrite existing data. Supports v1 and v2 archive formats with a maximum serialized size of 8 MiB. Treat export content as private.

The local API enforces a 12 MiB streamed HTTP request limit and adds no-store headers on notebook endpoints. Browser origins default to loopback and remote origins require an explicit unsafe development opt-in; see [Local API Security](LOCAL_API_SECURITY.md).

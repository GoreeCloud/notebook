# Indexed local search — SQLite FTS5

The Notebook service now maintains a private full-text index of **active notes** using SQLite FTS5 (Unicode word tokenization and diacritic folding). The index covers titles, bodies and JSON tags and applies a weighted BM25 ranking favoring title matches, then tags, then body. It accepts a prefix query with up to twelve Unicode word tokens; special query grammar is **not** exposed to clients. Note title/body/tag changes, JSON/ENEX/Markdown ZIP imports, Trash moves and restoration update the index automatically through database triggers.

```http
GET /api/v1/search?q=orchid&limit=50&offset=0
Authorization: Bearer <local-development-token>
```

Responses include `backend`, `results` (note objects), `has_more`, `limit` and `offset`. `q` is required (1-200 characters), `limit` 1-200 and `offset` 0-5000. The React web search uses a short debounce, cancels stale requests and shows the first 200 ranked matches. No server-side search queries or content are forwarded outside the local service.

The `notes_fts` virtual table is created only if the embedded SQLite build supports FTS5. Builds without FTS5 use a bounded, SQLite-paginated LIKE fallback that searches active note titles, bodies and stored tag text. It applies notebook filtering and all sanitized query terms before LIMIT/OFFSET, including for libraries larger than 500 notes. Unlike FTS5, it has substring rather than prefix-token matching, no BM25 ranking and potentially slower scans; offset pages are not a snapshot of a mutating collection. The existing `GET /api/v1/notes?q=` API remains available for compatibility.

On first launch against an older service SQLite file the index is populated from current active notes. Future edits/imports are tracked via SQL triggers, preserving existing stored note content. The FTS index is **derived local data and is not encrypted**; the index and SQLite database must have device access controls. Full-text ranking may lag behind a newly typed unsaved draft. Trash content is excluded from FTS results but stays in the normal Trash UI. Export and repair/index rebuild tooling, large-corpus benchmarks and language-sensitive stemming remain unimplemented.

This is local search indexing, **not** GoreeCloud public web Search, Mesh synchronization, Identity, or cross-device indexing. Test evidence is in `server/tests/test_search_fts.py`.

## Notebook-aware search scope

An optional `notebook_id` parameter constrains FTS matching **before** applying ranking, limit and offset. The web app uses the selected notebook filter when querying the API, ensuring a large collection in another notebook cannot use up the first 200 ranked search results. Omitting the parameter searches all notebooks. This is user-selected query scoping, **not** an Identity authorization boundary; the shared development bearer token still has access to the complete local SQLite service database.

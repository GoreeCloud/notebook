# Local wiki-links and backreferences — development preview

An authenticated, read-only Notebook link graph is available from `GET /api/v1/notes/{id}/links?limit=50&offset=0`. It reports **incoming** (notes referring to this note) and **outgoing** (notes referred to by this note) as separate bounded result pages, with `has_more` flags. Maximum 100 items per direction per request; offsets 0–10000. The existing authenticated `/notes/{id}/backlinks` list endpoint remains available with the same legacy array shape, now scanning beyond the first 500 displayed notes.

Supported local Markdown wiki syntax:

- `[[Note Title]]` resolves to an active note with that unique case-insensitive exact title **within the current note's notebook**. If two active notes share the same title in that notebook, the title link is intentionally **ambiguous and unresolved** rather than silently pointing to the wrong note.
- `[[note:01234567-89ab-cdef-0123-456789abcdef]]` or `[[note:01234567-89ab-cdef-0123-456789abcdef|Readable label]]` resolves directly to the active note's stable UUID. These explicit ID links may refer to notes in other notebooks within the same authenticated local workspace. The label is display text only and does not affect resolution.
- Broken IDs, missing titles, self-links and Trash targets are excluded. Trash notes are not indexed as sources. Renaming an ID-linked target does not break the link; title links are not rename-stable.

The web editor displays resolved incoming/outgoing notes beneath the current note with buttons to follow references. It confirms before discarding unsaved edits, switches to the link's notebook when needed, and includes a fetched note in its local UI state if it was not in the initial displayed list. Results are **read-only**, require the existing local bearer token, and are never shared or tracked outside this Notebook service.

**Performance/privacy limits:** This is a derived graph computed when requested. It uses a compact active note metadata index, prefilters active note bodies containing `[[`, scans source bodies in updated-time order, and stops once sufficient incoming results have been found for the requested page. It does **not** maintain a background crawl, send traffic to remote URLs, persist a hidden relationship table, or expose note content to unauthenticated callers. Opening a graph with a very large library may still be computationally expensive; benchmarking and a future incremental index are open work. A link inside a Markdown code fence may currently count as a link; syntactic Markdown AST handling is not implemented.

**Verification:** Synthetic tests cover name ambiguity, Unicode casefold, scope, stable cross-notebook UUID links, rename durability, Trash exclusions, authentication, pagination, invalid parameters and an incoming note beyond 500-note display cap. The React build validates types; actual cross-browser keyboard/AT acceptance has not been performed. This is not GoreeCloud Mesh device replication, GoreeShield consent enforcement or GoreeCloud Identity authorization.

## Authenticated summary-only graph and SQLite snapshot

An opt-in query flag, GET /api/v1/notes/{id}/links?summary=true,
returns bounded 160-character previews and list metadata for both link
directions, **omitting complete Markdown note bodies**. The default graph
and legacy backlinks endpoints retain their existing full-note contract.
The web editor requests compact link previews, keeps already-hydrated notes
intact and requires a separate authenticated full-note detail request before
a followed note becomes editable. This protects against accidentally saving
a truncated 160-character preview as the full Markdown body.

The graph source title index and its incoming/outgoing references are now
read from one explicit SQLite transaction. A deterministic WAL test inserts a
concurrent Trash update between metadata and note row reads, verifying that a
single graph remains internally consistent. A subsequent fresh graph reflects
the committed Trash change. Offset paging across separate requests can
still shift if a live library is edited; the API does not offer a durable
snapshot cursor. Graphs remain entirely local to the bearer-protected service,
are not encrypted in RAM, and are not GoreeShield/Identity policy enforcement.

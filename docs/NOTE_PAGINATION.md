# Local notes list pagination — development preview

The existing authenticated `GET /api/v1/notes` endpoint remains a **backward-compatible JSON array** capped at 500 notes for existing clients. A new opt-in `GET /api/v1/notes/page` endpoint returns a bounded page envelope:

```json
{
  "results": [],
  "has_more": false,
  "offset": 0,
  "next_offset": 0,
  "limit": 200
}
```

Query parameters: `notebook_id` (optional), `q` (optional literal LIKE text, up to 200 characters), `include_deleted` (default false), `limit` (1–500, default 200) and `offset` (0–100000, default 0). It uses the **same safe SQL filtering, escaping and stable relative sort order** as `GET /notes`. The server fetches one extra sentinel row to determine `has_more`. The next page should be requested with `next_offset`. It is not a new authentication mechanism; the same bearer token is required.

The React notes list initially loads its existing **500-note** batch and now exposes an explicit **Load more stored notes** button if the server reports more rows. Load-more requests use the authoritative paging cursor and append unseen note IDs, so search results or independently followed note links do not corrupt the offset. The button has accessible text and an explicit loading state. This is an incremental capability, not full virtual scrolling or human keyboard/screen-reader acceptance.

**Consistency limits:** Offset paging is not a read-transaction snapshot across requests. If a user inserts, edits, deletes, restores or pins notes while paging, relative order may change and items can be skipped or repeated between pages. The browser deduplicates repeated IDs, but cannot guarantee an immutable historical view. The full JSON export and offline backup utilities use different consistent data access and are not restricted by this display paging. A future durable cursor or snapshot-based listing protocol remains a separate task.

**Security/privacy:** No new untrusted SQL expression is evaluated; the literal LIKE escaping and parameter binding are reused. Pages are capped at 500 rows and offset 100000. No automatic cloud transfer, background telemetry, account sharing or secrets are introduced. The route remains within the existing local authenticated API boundary.

**Test evidence:** Synthetic test data with 535 notes exercises the legacy 500 cap, two paging requests, unique identifiers, exhausted pages, authentication, notebook filters, Trash, literal `%`/`_` pattern matching, and rejection of out-of-range paging arguments. React TypeScript/Vite and web contract tests run in CI. Manual 600+ item UI, accessibility and long-lived concurrent mutation acceptance are not yet completed.

## Body-minimized web pages and explicit full-text hydration

The opt-in summary=true mode of GET /api/v1/notes/page returns bounded
160-character previews instead of full Markdown bodies, while preserving
note ID, title, notebook, hierarchy, tags, pin, Trash and version metadata.
The default page and legacy array endpoints remain unchanged.

The React sidebar uses summary mode for its initial and Load More batches,
then fetches the complete selected note by ID BEFORE mounting any editable
Markdown fields. A summary-only stub is never passed into updateNote or
another save path, preventing a 160-character preview from overwriting
a longer note. Failed hydration keeps the editor locked and offers retry.
The detail route accepts optional include_deleted=true (default false)
so Trash previews can be opened and restored without broadly enabling
deleted-note reads. All endpoints still require the local bearer token.

This is response minimization and browser-memory improvement, not encrypted
client storage, GoreeShield consent enforcement or a virtualized list.
Search-ranked results still transfer full bodies; local preview filtering
may temporarily be incomplete while ranked search is pending.

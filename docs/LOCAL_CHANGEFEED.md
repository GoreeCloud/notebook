# Local note change cursor — Mesh readiness only

The local SQLite store now appends monotonic mutation metadata to `note_change_events` using SQLite triggers. This records note creation and all edits, including soft delete and restore, from both the app and JSON/ENEX import paths.

```http
GET /api/v1/changes?after_cursor=0&limit=100
Authorization: Bearer <local-development-token>
```

Returns an ordered array of `cursor`, `note_id`, `notebook_id`, `version`, `deleted_at`, and `recorded_at`, plus `next_cursor`, `latest_cursor`, `has_more`, and an explicit local scope marker. Clients paginate using `next_cursor`, not local timestamps. Each response obtains `latest_cursor` and its event page in one explicit SQLite read transaction; concurrent writes cannot slip into the same response after that high-water mark. This mark is local and per-response, not a cross-request snapshot, persistent remote cursor, or event-retention guarantee. The endpoint does not send note bodies or access history. Query results are subject to the same development bearer token as all other notebook API endpoints.

When upgrading an older SQLite database without the event table, Notebook seeds one current-state event for each existing note, **not** a reconstruction of every historical change. The table and triggers are additive; existing notes remain unchanged. The event log grows until future retention rules are implemented.

**Not a sync implementation:** There is no remote server replication, pairing, registered identities/devices, end-to-end encryption, GoreeShield consent/sharing policy enforcement, Wardveil network hardening, signed events, per-device cursors, conflict resolution, or verified GoreeCloud Mesh transport. Event metadata alone cannot reproduce previous note content or notebook creation events. Do not expose this endpoint to the internet or treat it as a production integration contract.

Before designing Mesh transport: define user/device authorization, schema version/cursor expiration, privacy minimization, authenticated recovery snapshots, full-note content fetching, attachment handling, deletion retention, backpressure and conflict policy; validate them across the three clients.

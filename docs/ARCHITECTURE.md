# Architecture and MIPS responsibilities

```text
React/Vite browser --Bearer/HTTP--> FastAPI REST --> SQLite (local)
Qt Quick 6.12 native Linux ------------local----> SQLite (same host/account)
Kotlin/Compose Material 3 Expressive Android --> SQLite (Android app sandbox)
```

This is an **offline-native local-first foundation**, not synchronized multi-device software. Canonical document content is UTF-8 Markdown. Each note has a UUID, optional parent ID, tags, version counter, soft-delete timestamp and revision history on the service database. SQLite owns transactions and foreign key validation. Android has a smaller independent schema.

The web API binds to loopback in the documented command and requires a random shared bearer token. No user account or remote access control is implemented. Do not use an external bind address without reviewed authentication, authorization, HTTPS, rate limits and deployment gates.

Mandatory platform systems:
- **GoreeCloud UI:** verified visual tokens from `GoreeCloud/gc-ui`; Android Material 3 Expressive and Linux Qt Quick 6.12.
- **GoreeCloud Mesh:** future authorized note sync and cross-product data exchange; no live channel yet.
- **GoreeCloud Identity:** future notebook-scoped users and permissions; shared secret is temporary development auth.
- **GoreeShield:** future consent, retention, user ownership and data-minimized exports.
- **Wardveil:** future threat scanning, policy checks, auditing and incident response.

Future synchronization should use signed, encrypted note change logs with explicit sharing policies, robust client cursors and tested conflict recovery. Evaluate Yjs collaboration after separate security/performance review; not part of current source.

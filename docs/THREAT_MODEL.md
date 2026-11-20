# Initial threat model

Assets: private note text, tags, hierarchy, revisions, bearer token, SQLite stores and exports. Trust boundaries: browser-to-API, local process-to-SQLite, app sandbox-to-disk; cross-device communication is absent.

| Risk | Present control | Unresolved |
| --- | --- | --- |
| Unauthorized API use | Strong shared token required | No accounts, per-object ACLs, sessions or rate limits |
| CSRF / malicious origins | Bearer Authorization header + explicit CORS origins | CORS is not a network firewall |
| XSS via Markdown | react-markdown without raw HTML | Future embedded content / URLs need audits |
| Concurrent edits | Optimistic `expected_version` / 409 | No automatic merge; draft loss possible |
| Device loss | Android app sandbox; OS filesystem ownership | No application-level encryption |
| Network interception | Documented localhost-only API | TLS and remote ingress not supported |
| Data loss | SQLite transactions + version history | No verified backup restore/import; Android backup disabled |
| Supply chain | Source-pinned direct deps and npm lock | Broader advisory, lock, SBOM, provenance checks needed |

GoreeShield governs privacy policies and user consent; Wardveil governs cybersecurity. Neither is technically integrated yet. Do not send notebook data to outside services by default.

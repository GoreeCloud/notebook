# Initial threat model

Assets: private note text, tags, hierarchy, revisions, bearer token, SQLite stores and exports. Trust boundaries: browser-to-API, local process-to-SQLite, app sandbox-to-disk; cross-device communication is absent.

| Risk | Present control | Unresolved |
| --- | --- | --- |
| Unauthorized API use | Strong shared token required; scoped body-size limit | No accounts, per-object ACLs, sessions or rate limits |
| CSRF / malicious origins | Bearer Authorization header + loopback-only CORS by default | CORS is not a network firewall |
| XSS via Markdown | react-markdown without raw HTML | Future embedded content / URLs need audits |
| Concurrent edits | Optimistic `expected_version` / 409 | No automatic merge; draft loss possible |
| Device loss | Android app sandbox; OS filesystem ownership | No application-level encryption |
| Network interception | Documented localhost-only API | TLS and remote ingress not supported |
| Data loss | SQLite transactions + private default file mode + version history | Local JSON import is tested; device-loss backup and external restore drill remain absent; Android backup disabled |
| Supply chain | Source-pinned direct deps and npm lock | Broader advisory, lock, SBOM, provenance checks needed |

GoreeShield governs privacy policies and user consent; Wardveil governs cybersecurity. Neither is technically integrated yet. Do not send notebook data to outside services by default.

Additional local API controls, unresolved remote exposure risks, and test evidence are in [Local API Security](LOCAL_API_SECURITY.md).

# Privacy and Data Handling — Development Disclosure

GoreeCloud Notebook is intended to be privacy-first and self-hosted. **It has not been deployed, audited or independently validated as a GoreeCloud product.** This page documents the current development boundary, not a public production privacy guarantee.

- **Data residency:** The imported TriliumNext architecture supports self-hosting, but a user's actual data residency depends on their chosen installation, network, backups and integrations. No GoreeCloud hosted service is claimed.
- **Data types:** Notes can contain text, metadata, attachments, revisions, tags, links and optionally sensitive material. They must be protected by appropriate server, filesystem and backup controls.
- **Network:** Sync servers, web clippers, sharing links, user-authored scripts and optional third-party integrations can exchange data. No claim that every path stays offline or end-to-end encrypted has been established.
- **Secrets:** Do not commit keys, passwords, database copies, telemetry identifiers or personal notebooks. Use environment/secret management with least privilege.
- **Import/export:** Evernote ENEX and other exports may contain personal information and embedded resources. Inspect destination and external access boundaries before uploading or sharing them.
- **Recovery:** Keep encrypted backups under your control. Restore and upgrade fidelity remain unverified in this derived application.
- **Data deletion:** No production retention, deletion guarantee or recovery timeline can be represented without deployment-specific evidence.

Privacy, backup, deletion, consent, accessibility and source-disclosure obligations require a release-specific review before any production publication.

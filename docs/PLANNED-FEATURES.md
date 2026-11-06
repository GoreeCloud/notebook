# GoreeCloud Notebook — Planned Features

These features are **not implemented** in the v0.1.0 preview. Priority is based on user data safety, required GoreeCloud controls and development dependencies.

## P0 — Acceptance and data integrity
- Expand the existing passing Chromium smoke test beyond note editing, persistence and stale-tab conflict rejection to cover hierarchy move, note links, more edge cases, multiple browser engines and offline installation on supported devices. Chromium smoke already covers search, tasks, archive/trash restoration, JSON import/export and offline shell reopening.
- Browser/device matrix, keyboard, screen reader and GC UI screenshot-led acceptance.
- IndexedDB migrations, automatic multi-tab conflict resolution (stale-write detection already exists), recovery journal, quota handling and verified backups.
- Migrate legacy title-based links to the now-verified stable-ID format, with a broken-link report and link-remapping tools; add typed graph relationships.
- Canonical GC UI token and component integration.
- Secure import validation, quotas, export verification and privacy review.

## P1 — Rich knowledge management
- Complete Markdown/rich-text editor, code, tables, LaTeX and media embeds.
- Multi-parent note cloning, inherited metadata, custom attributes and relation types.
- Relationship graphs, mind maps, diagrams, notes-as-collections and saved searches.
- Revisions, attachments, PDF/HTML previews, content-addressed storage and full-text index.
- Portable Markdown/ENEX/TriliumNext/Notion/OneNote/Keep migration with loss reporting.
- Templates, recurring tasks, reminders and calendar views.

## P2 — Capture and assistance
- Browser web clipper with provenance and safe HTML processing.
- Scanning, OCR, PDF tools and searchable images.
- Authorized audio/video recording, transcripts and meeting summaries.
- Optional GoreeCloud AI with per-note context permissions and user consent.
- Local AI adapters with data flow disclosure and encrypted-content exclusions.
- Spatial canvas, drawing, geographic notes and advanced media note types.

## P3 — Connectivity and collaboration
- GoreeCloud Identity authentication, sessions and role-based permissions.
- GoreeCloud Mesh synchronization protocol, conflict resolution and opt-in self-hosted server.
- GoreeShield consent/retention controls and Wardveil security monitoring.
- Shared notebooks, permissions, publishing, revocation and audit trails.
- Native desktop/mobile delivery after architecture and acceptance gates.
- Connectors for Search, Mail, Maps, Projects, Analytics, Browser Mobile and other authorized services.

## P4 — Developer ecosystem
- Sandboxed plugins and code note scripting (disabled by default).
- Scope-limited REST API, webhooks, MCP tooling and automation.
- Advanced dashboards, administration, localization and performance testing.

**Status rule:** Keep unverified work on this list until source, tests, actual operation and acceptance criteria support moving it to implemented features.

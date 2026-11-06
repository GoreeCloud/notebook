# GoreeCloud Notebook — Planned Features

These features are **not implemented** in the v0.1.0 preview. Priority is based on user data safety, required GoreeCloud controls and development dependencies.

## P0 — Acceptance and data integrity
- Expand the existing passing Chromium smoke test beyond note editing, persistence and stale-tab conflict rejection to cover additional hierarchy edge cases, accessibility, multiple browser engines, restored data under quota pressure and offline installation on supported devices. Chromium smoke now covers nested-note creation/move, permanent links, search, tasks, archive/trash restoration, import/undo/export and offline shell reopening.
- Browser/device matrix, keyboard, screen reader and complete GC UI screenshot-led acceptance (a targeted before/after Chromium screenshot review is documented in docs/VISUAL-REVIEW.md).
- IndexedDB migrations, automatic multi-tab conflict resolution (stale-write detection already exists), multi-version revision recovery beyond the one-step import checkpoint, full storage-quota exhaustion recovery (basic estimate and persistence request now implemented) and verified external backups. Read-only aggregate import impact and cancellation now exist; optional per-note diffs, merge options and more recovery history remain planned.
- Migrate legacy title-based links to the now-verified stable-ID format, with a broken-link report and link-remapping tools; add typed graph relationships.
- Complete canonical GC UI component/pattern integration and the founder-approved 100-principle visual acceptance review. Foundation-level semantic tokens, automatic OS high-contrast palette selection and focus styling from the verified 1.0.1 release are pinned and tested; full component migration and high-contrast interaction/accessibility acceptance are unfinished.
- Extend the now-implemented standard gzip JSON backup and bounded 64 MB restore with low-memory/record-by-record import, chunked storage and recovery beyond 64 MB; verify archive size limits, real disk/quota behavior and device compatibility.

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

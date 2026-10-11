# GoreeCloud Notebook — Development Specifications

**Scope:** A derived, privacy-first, self-hosted, searchable knowledge application intended as an Evernote alternative. **State:** Proposed product acceptance criteria; upstream baseline imported but not yet accepted as GoreeCloud functionality.

## Architecture

Preserve upstream pnpm workspace interoperability across `apps/client`, `apps/server`, `apps/desktop`, `apps/mobile`, `apps/standalone`, `apps/web-clipper`, and shared `packages` until each can be replaced safely. Data migration must preserve note identity, internal links, attachments, revisions, attributes and tree relationships.

## Mandatory product requirements

1. Capture, organize, edit, search and securely export notes without vendor lock-in.
2. Import Evernote ENEX with an inspectable dry run, attachment preservation, duplicate handling and error report; never alter the source ENEX.
3. Safeguard original notebooks during upgrade and migration: backups, tested restore, schema compatibility checks, explicit error handling and rollback where technically possible.
4. Maintain self-hosted operation, least-privilege account access, safe update strategy and meaningful offline indicators; avoid inaccurate promises about offline guarantees.
5. Adopt the active Stable Glaze contract across controlled surfaces with explicit desktop, mobile, keyboard, assistive technology, reduced-effects and forced-colors acceptance.
6. Support observable, opt-in integrations and maintain portability through Markdown, HTML and other supported export paths.
7. Preserve AGPL-3.0 terms, copyright notices, source availability obligations and upstream history.
8. Avoid shipping inherited release/publishing workflows before their targets, permissions, artifact paths and credentials are audited.

## Completion gates

A source change is not a verified feature acceptance. Gate each milestone through tests of the exact source, manual user paths where required, access-control review, performance, privacy and security evidence, and upgrade/restore qualification. Production, Stable and Glaze compliance remain unverified until recorded evidence exists.

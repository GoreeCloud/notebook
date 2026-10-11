# GoreeCloud Notebook

**A privacy-first, self-hosted notebook and personal knowledge workspace.**

GoreeCloud Notebook is GoreeCloud's intended Evernote alternative. Its implementation begins from the **TriliumNext/Trilium** codebase, preserves the upstream AGPL-3.0 license and pins its source revision, and is being rebuilt toward the GoreeCloud Platform Contract and **Glaze — GoreeCloud Design & Experience System**.

> **Development status:** This repository contains imported upstream source and an initial GoreeCloud adaptation. GoreeCloud Notebook is **not** certified, production-ready, Stable, fully rebranded, or a verified Glaze 1.7 consumer. Features listed below are upstream capabilities and require fork-specific testing.

## Product direction

- Capture notes, attachments, web clips and ideas with rapid search.
- Organize hierarchical notebooks, tags, attributes, links and reusable structures.
- Author rich text, Markdown/source notes, tables, sketches and media.
- Import Evernote exports and support reversible exports/migration.
- Support self-hosted synchronization and privacy-conscious offline workflows.
- Deliver an accessible, adaptive Glaze desktop/web/mobile experience without introducing a second design-system authority.

## Provenance and upstream

| Property | Value |
| --- | --- |
| Original project | [TriliumNext/Trilium](https://github.com/TriliumNext/Trilium) |
| Imported upstream revision | `6246ce308109e90fe2e86fe8883d129e5f3e35a5` (2026-10-10) |
| License | [GNU AGPL-3.0-only](LICENSE), inherited notices retained |
| Source-control destination | [GoreeCloud/notebook](https://github.com/GoreeCloud/notebook) |
| GoreeCloud lifecycle | Development; not yet deployed or accepted |
| Glaze target | V1.7 / 1.7.0 current Stable contract; consumer acceptance pending |

Because this repository existed before import, it is a **source-derived repository**, not a GitHub-native fork relationship. The published branch uses a bounded source snapshot: the full upstream commit history remains in [TriliumNext/Trilium](https://github.com/TriliumNext/Trilium), but is **not** part of the snapshot branch ancestry. See [upstream maintenance](docs/UPSTREAM.md).

## Evernote import readiness (Development only)

A read-only ENEX structure preflight is available with Python 3:

```bash
python3 scripts/goreecloud/enex_preflight.py /path/to/export.enex
```

It streams a local export and prints aggregate note, resource, tag, and possible-duplicate counts **without** sending note content to a remote service, importing data, or modifying the ENEX file. Rejects malformed XML, DTD/entities and overly large exports. This is a pre-import diagnostic, **not** a substitute for a tested Evernote migration or data fidelity verification.

## Development

This codebase is a pnpm monorepo (Node and toolchain versions are inherited from upstream). Read the upstream installation notes and `package.json` before installing dependencies or running build scripts. Never point Development builds at real notebooks without tested backup, restore, and migration procedures.

See the [complete 20-domain product vision](docs/COMPLETE-FEATURES-AND-CAPABILITIES.md) and [capability traceability map](docs/CAPABILITY-TRACEABILITY.md) (**proposed scope, not implemented-feature evidence**), [specifications](docs/SPECIFICATIONS.md), [implemented source baseline](docs/IMPLEMENTED-FEATURES.md), [remaining rebuild work](docs/PLANNED-FEATURES.md), [privacy](docs/PRIVACY.md), [manual](docs/USER-MANUAL.md), and [security](.github/SECURITY.md).

## Safety and legal

The repository remains AGPL-3.0-licensed; retain upstream attribution and provide corresponding source to network users as required. There is no claim of complete end-to-end encryption, independent security audit, high availability, or safe irreversible migration. Do not deploy or publish binaries until release checks, licensing review, security review, restore tests, and Glaze consumer acceptance are complete.

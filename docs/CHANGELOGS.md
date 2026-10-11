# GoreeCloud Notebook — Changelog

## Unreleased — development foundation (2026-10-10)

- Imported the TriliumNext source snapshot pinned to the upstream revision into a development branch; complete upstream history is not published in the snapshot branch.
- Established the AGPL-3.0 source and attribution boundary.
- Disabled inherited unaudited release and deployment workflows in the derived branch.
- Added a constrained source-integrity validation workflow and documentation.
- Implemented a development Glaze-semantic CSS adaptation in the client bootstrap.
- Added a local, read-only ENEX preflight CLI with six import-structure and security-oriented tests.
- Implemented an in-dialog Evernote file-review checkpoint with bounded local header inspection, explicit backup acknowledgment, selection-change invalidation, English fallback strings, semantic Glaze styling and dependency-free Node tests.

- Captured the complete owner-provided 20-domain feature and capability product vision, product principles and long-term definition as a separate proposed-scope record with references from the repository documentation. No new feature implementation or acceptance is implied.
- Added a 20-domain capability-to-roadmap traceability matrix and automated structural checks; tightened Evernote local header review to ignore XML-like declarations inside actual note content.
- Added an independent pull-request client build-qualification job without deployment steps using the pinned package-manager and frozen lockfile. The first build detected an incomplete filtered install (share-theme's separate Fuse dependency); the qualification job now installs both client and share-theme dependency closures. The corrected build requires fresh exact-head verification.

- Verified both client and server packaged-source builds on draft-PR head `058be388e345c4bc6c8e1e605d2a4261446cf67e` in CI; server qualification builds its bundled web assets and PDF viewer without deploying. The independent importer fixture test hit a missing generated web-clipper TypeScript configuration before tests started, so the test job now explicitly prepares WXT before running; exact-head requalification is required.

- The Evernote file review now blocks repeated selections of the same export within one batch; it uses only local file identity and metadata, shows a descriptive warning and has regression coverage. This does not detect duplicates in an existing notebook.

This is source development, not a public release, verified build, deployment or Glaze conformance claim.

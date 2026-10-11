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

- Prioritized everyday Notebook features and Glaze UI over further Evernote migration work. Added quick-search clear and retry controls, localized offline/error feedback, protection against late responses to cleared searches, responsive focus styling and focused UI interaction tests. This source improvement requires exact-head qualification, not just a successful build.

- Added one-click Inbox capture beside Quick Search, with query clearing and stale-result cancellation; the development PR UI gate passed 23 Quick Search interactions on head `1c7821d75a`.
- Added a searchable command-palette Inbox capture action with aliases and localized text. On head `8dba9e745e`, six CI jobs passed, including 51 Quick Search and Command Palette interaction tests (run 38105989431).

- Added a discoverable command-palette action for creating notes from a chosen note type or template, reusing existing template defaults and a safe active-parent guard. Regression coverage tests the action and missing-parent behavior; real-app acceptance is pending.

- Added a searchable Recent Changes action for the selected subtree with a no-selection guard; the client UI CI job also runs the existing note-creation regression suite.

- Scoped backlink results to the selected note and invalidated late network responses on navigation and unmount. Added retry feedback for unavailable backlink requests and covered note-switch races and recovery in the client UI CI suite. The backlink count indicator also discards late counts from previously selected notes and hides counts outside its supported view.

- Exposed View Note Revisions and Copy Link to Current Note via searchable Command Palette actions, reusing the existing revision dialog and clipboard helper. Added four regressions for command lookup, dispatch and no-note guards.

This is source development, not a public release, verified build, deployment or Glaze conformance claim.

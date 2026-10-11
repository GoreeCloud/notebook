# Implemented source — verified repository state

## Source present, runtime acceptance pending

- **UPSTREAM-IMPORT-001:** TriliumNext upstream main source revision `6246ce308109e90fe2e86fe8883d129e5f3e35a5` imported as an exact source snapshot in a development branch. Upstream commit ancestry is not in that branch, and an unmerged complete-history attempt remains local only.
- **REPO-SAFETY-001:** Original inherited publishing/deployment GitHub Actions disabled in the derived branch; a constrained source-integrity workflow replaces them.
- **GLAZE-ADAPTER-001:** An additive Glaze-semantic Notebook stylesheet mapping is present in the client source and linked through the normal stylesheet loader. This is only a **development integration**, not current-Stable consumer acceptance.
- **ENEX-PREFLIGHT-001:** A read-only, no-network ENEX structure inspection CLI reports aggregate note, tag and resource counts, screens malformed XML and DTDs, and has six local unit tests. It does **not** import notes or qualify the upstream ENEX importer.
- **ENEX-REVIEW-001:** The Evernote import panel locally checks a bounded export-file header, displays selection-specific results, and requires an explicit backup acknowledgement before enabling upload. This does not fully parse the ENEX, preview imported notes, or establish server-side import fidelity; browser and runtime acceptance remain pending.
- **QUICK-SEARCH-UX-001:** Quick search now has a visible Glaze-styled clear action, an explicit retry for failed requests, localized connection-error feedback, and request invalidation when a query is discarded. The dedicated client UX CI gate ran 21 component interaction tests successfully on development commit `f2706dca3ed5e64955ae360f304647749678fcff`. Actual installed web/desktop accessibility and runtime acceptance remain pending.
- **QUICK-CAPTURE-001:** One-click Inbox note action uses the existing note creation command; 23 UI component tests passed on PR head `1c7821d75a` (GitHub Actions run 38104695147). Installed-app acceptance remains pending.
- **QUICK-CAPTURE-PALETTE-001:** Inbox capture is also available as a searchable command-palette action, including quick-capture aliases and use without an active note. The exact-head CI run 38105989431 passed all 51 Quick Search and Command Palette component tests on commit `8dba9e745e`; installed-runtime and accessibility acceptance remain pending.
- **DOCS-BASELINE-001:** Source-linked provenance, specifications, privacy/security disclosure, product status and planned capability records.

## Inherited upstream implementation (not fork-tested)

TriliumNext source contains notes, editors, hierarchical organization, search, import/export, server/desktop and web-clipper code. Their existence in Git is verified. Client, server, and desktop source bundles pass GitHub Actions build checks, but installed application runtime, security properties, real-world migration correctness, and Glaze consumer acceptance remain unverified.

No public GoreeCloud Notebook Stable release or production deployment is claimed.

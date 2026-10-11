# Upstream provenance and update procedure

**Source:** `https://github.com/TriliumNext/Trilium.git`
**Source head at import:** `6246ce308109e90fe2e86fe8883d129e5f3e35a5`
**Intended target:** `GoreeCloud/notebook` on the isolated `feat/notebook-source-snapshot` branch.
**Import method:** A complete-history merge was assembled locally but its Git transfer was stopped because it was too resource-intensive. The publication candidate is a source snapshot committed on top of the original GoreeCloud main. Full TriliumNext history stays authoritative in the upstream repository and is **not** included in the published candidate ancestry. This is not a GitHub-native fork relationship.

## Upstream synchronization

1. Create a fresh branch from verified GoreeCloud `main`. Record both exact heads.
2. `git remote add upstream https://github.com/TriliumNext/Trilium.git` if missing; `git fetch upstream main`.
3. Read upstream release notes, package/lockfile changes, schema changes, security advisories and license/notice changes.
4. Merge using normal merge commits; never force-push the governed branch. Resolve conflicts to preserve GoreeCloud identity and compatible upstream functionality.
5. Re-run focused tests, backup and restore, representative imports, desktop/web/mobile smoke checks, Glaze behavior and accessibility checks.
6. Revalidate exactly the PR head being merged and maintain rollback evidence. No unreviewed automatic upstream-sync publication.

## CI and publishing safety

Original upstream GitHub Actions workflows were **removed from the derived branch's active workflow directory**, while remaining recoverable from upstream Git history. Those workflows include original publishing, deployment, release and package-upload targets that must not run under GoreeCloud credentials by accident. Only the deliberately scoped GoreeCloud source-integrity check is enabled. Any future deploy, release or package workflow requires destination and credential audits, least privileges, build evidence, and explicit governed acceptance.

## License

TriliumNext is AGPL-3.0-only. Keep `LICENSE`, upstream copyright/attribution, and third-party notices. Do not claim the fork's work is independently relicensed. Network-server modifications may require offering corresponding source to network users. Do not remove appropriate legal notices during rebranding.

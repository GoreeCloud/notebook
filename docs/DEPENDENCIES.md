# Open-source components and provenance

No application source was copied from Evernote, Trilium Notes or AFFiNE. Original code in this repository is MIT licensed. Third-party licenses remain theirs; validate at upgrade/distribution.

| Dependency | Function | Upstream licensing / reference |
| --- | --- | --- |
| FastAPI, Pydantic | API and validation | MIT — https://github.com/fastapi/fastapi ; https://github.com/pydantic/pydantic |
| Uvicorn | ASGI server | BSD-3-Clause — https://github.com/encode/uvicorn |
| React, Vite | Web UI / build | MIT — https://github.com/facebook/react ; https://github.com/vitejs/vite |
| TypeScript | Web typecheck | Apache-2.0 — https://github.com/microsoft/TypeScript |
| react-markdown, remark-gfm | Safe Markdown preview | MIT — https://github.com/remarkjs/react-markdown |
| Lucide | Browser icons | ISC — https://github.com/lucide-icons/lucide |
| PyCA cryptography 50.0.2 (optional) | Offline authenticated encrypted SQLite backups | Apache-2.0 OR BSD-3-Clause — https://github.com/pyca/cryptography |
| PySide6 / Qt 6.12 | Native Linux UI | LGPL/GPL/commercial options; review Qt redistribution compliance — https://www.qt.io/qt-for-python |
| Kotlin, AndroidX / Compose Material 3 Expressive | Native Android | Apache-2.0 — https://github.com/JetBrains/kotlin ; https://android.googlesource.com/platform/frameworks/support |
| Gradle | Android builds | Apache-2.0 — https://github.com/gradle/gradle |
| GoreeCloud UI | Visual design tokens | MIT — https://github.com/GoreeCloud/gc-ui |

Considered but **not imported**: Trilium Notes (AGPL-3.0, https://github.com/TriliumNext/Trilium); Tiptap OSS core (MIT, https://github.com/ueberdosis/tiptap); Yjs (MIT, https://github.com/yjs/yjs); AFFiNE (mixed licensing by component, https://github.com/toeverything/AFFiNE).

`web/package-lock.json` pins resolved npm packages. Python direct requirements and Android Gradle versions are pinned; transitive Python dependency hashes, dependency-lock verification, SBOM and reproducible release attestations still need work.

## GitHub Actions runner provenance (November 20, 2026)

GitHub's official `actions/checkout` v7.0.1 (commit `3d3c42e5aac5ba805825da76410c181273ba90b1`), `actions/setup-python` v7.1.0 (commit `6d4fd22b20465ccc0f7354476588e8df7c9ca0e0`), and `actions/setup-node` v7.1.0 (commit `949feb2413d6458794dcd2491c4babbbce0c15c1`) are pinned to the **exact verified public release-tag commits** in CI. Their upstream `action.yml` metadata declares `node24`, resolving Node 20 deprecation notices from the previous major versions. These are GitHub-owned public projects and release/tag data was inspected before adopting. Upstream release notes: [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-python v7.1.0](https://github.com/actions/setup-python/releases/tag/v7.1.0), [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0).

Pinned versions prevent a moving-major release tag from silently changing executed action bytes. The workflow still requires all four original protected check contexts and does not introduce any extra permissions or remote secrets. New major actions must pass clean GitHub-hosted CI before merging; action-level pinning is not a complete supply-chain review.

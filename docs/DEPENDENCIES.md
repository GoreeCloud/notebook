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
| PySide6 / Qt 6.12 | Native Linux UI | LGPL/GPL/commercial options; review Qt redistribution compliance — https://www.qt.io/qt-for-python |
| Kotlin, AndroidX / Compose Material 3 Expressive | Native Android | Apache-2.0 — https://github.com/JetBrains/kotlin ; https://android.googlesource.com/platform/frameworks/support |
| Gradle | Android builds | Apache-2.0 — https://github.com/gradle/gradle |
| GoreeCloud UI | Visual design tokens | MIT — https://github.com/GoreeCloud/gc-ui |

Considered but **not imported**: Trilium Notes (AGPL-3.0, https://github.com/TriliumNext/Trilium); Tiptap OSS core (MIT, https://github.com/ueberdosis/tiptap); Yjs (MIT, https://github.com/yjs/yjs); AFFiNE (mixed licensing by component, https://github.com/toeverything/AFFiNE).

`web/package-lock.json` pins resolved npm packages. Python direct requirements and Android Gradle versions are pinned; transitive Python dependency hashes, dependency-lock verification, SBOM and reproducible release attestations still need work.

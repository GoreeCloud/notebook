# GoreeCloud Notebook — Roadmap

| Milestone | Goal | Verification gate |
| --- | --- | --- |
| 0.1 development preview | Offline PWA, note hierarchy, editing, search, tasks, backup | Syntax + 18 model tests + Chromium editor/storage/conflict, nested hierarchy, task, search, import undo, backup and offline shell checks verified; partial screenshot-led review completed; multi-device UX remains pending |
| 0.2 durability | Extend passing conflict/undo controls and bounded gzip JSON restores with record-level IndexedDB, migrations, multi-version recovery and larger/low-memory backup support | Real quota exhaustion, gzip device compatibility, >64 MB restore, multi-tab and migration regression tests |
| 0.3 knowledge | Extend verified stable-ID links with legacy-link migration, attributes, graph, rich Markdown and collections | Link-migration, graph and structure integrity checks |
| 0.4 capture | Attachments, clipping, OCR, reminders, calendar | Input sanitation, media and accessibility tests |
| 0.5 AI and Sync | Optional permitted AI, Identity and Mesh adapters | Consent, authorization and secure transport acceptance |
| 0.6 collaboration | Shared spaces, revocation, publishing and audit | Permission and privacy test suite |
| 1.0 candidate | Secure, polished, portable cross-device product | Formal founder release acceptance |

## Immediate recommendations

- Broaden the passing Chromium smoke to actual storage pressure, cross-browser gzip import/export and device-level recovery; existing backup, task, search, archive/trash and responsive checks already pass.
- Treat data protection and migrations as prerequisites for new storage complexity.
- Migrate existing title-only links to the now-supported ID-stable syntax before larger datasets.
- Verify official GC UI palettes and components; do not claim visual compliance from CSS alone.
- Do not implement cloud sync before GoreeShield, Wardveil, Identity and Mesh contracts are ready.
- Keep unverified features on the planned list, not in release notes.

No production deployment, release acceptance or native installation is claimed here.

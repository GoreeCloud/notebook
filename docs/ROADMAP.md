# GoreeCloud Notebook — Roadmap

| Milestone | Goal | Verification gate |
| --- | --- | --- |
| 0.1 development preview | Offline PWA, note hierarchy, editing, search, tasks, backup | Syntax + 9 model tests + Chromium editor/storage/conflict, task, search, recovery, import/export and offline shell checks verified; multi-device UX and visual review pending |
| 0.2 durability | Record-level IndexedDB, migrations, conflict recovery, revisions, tested backups | Recovery, quota, cross-tab merge/reload and migration regression tests |
| 0.3 knowledge | Stable links, attributes, graph, rich Markdown and collections | Link integrity and graph consistency |
| 0.4 capture | Attachments, clipping, OCR, reminders, calendar | Input sanitation, media and accessibility tests |
| 0.5 AI and Sync | Optional permitted AI, Identity and Mesh adapters | Consent, authorization and secure transport acceptance |
| 0.6 collaboration | Shared spaces, revocation, publishing and audit | Permission and privacy test suite |
| 1.0 candidate | Secure, polished, portable cross-device product | Formal founder release acceptance |

## Immediate recommendations

- Expand the passing Chromium smoke to cover backup replacement, task workflows, search, archive/trash, responsiveness and real-device review before release decisions.
- Treat data protection and migrations as prerequisites for new storage complexity.
- Replace fragile title links with ID-stable links before larger datasets.
- Verify official GC UI palettes and components; do not claim visual compliance from CSS alone.
- Do not implement cloud sync before GoreeShield, Wardveil, Identity and Mesh contracts are ready.
- Keep unverified features on the planned list, not in release notes.

No production deployment, release acceptance or native installation is claimed here.

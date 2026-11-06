# GoreeCloud Notebook — Local Link Integrity Audit

**Scope:** v0.1 development preview, read-only diagnostic. This audit does not migrate, delete, rewrite, upload or share notes.

## How to run

Open **Settings → Audit note links**. The report appears inside Settings and includes:

- Total wiki links and number of active/archived source notes containing links.
- Number of permanent `[[id:note-id]]` references and legacy `[[Note title]]` references.
- Legacy title links that resolve to **exactly one** active target and are therefore potential future ID-migration candidates.
- Broken links (a permanent ID points to a missing/trashed note, or a title reference has no matching active target).
- Ambiguous legacy title links (two or more non-trashed notes have that title, ignoring case).

The report counts all matching links but displays only the **first 12 issue examples**, so a large workspace does not flood Settings. Issues include source note title and reference for local troubleshooting. All text is rendered as text, not interpreted as HTML.

Archived notes are included in both source and target checks. Trashed notes are excluded as sources and as viable targets. The audit recognizes the same simple double-bracket pattern used by the preview editor; it is **not** a full Markdown parser. Brackets appearing literally in code blocks may therefore be counted.

## Safe navigation

Permanent ID links survive title changes. For compatibility, legacy title links still work when the target title is unique. If multiple notes share a title, Notebook refuses to choose one arbitrarily. A legacy title reference is likewise not attributed as a backlink to multiple identically titled notes.

Use **Copy permanent link** on a target note to copy an ID-based reference. Manually replace ambiguous or fragile title references with that stable ID. There is **no automatic bulk migration or repair** in this development preview, and the report does not update notes.

## Security and limits

This feature runs entirely in the browser against the local in-memory workspace. It does not contact GoreeCloud servers, connected apps, an analytics endpoint, or an AI provider. Running the report does not write to IndexedDB, increment the save revision, or change the import-recovery checkpoint.

Unit tests cover unique links, broken IDs, missing titles, duplicate titles, archived/trashed notes, capped examples, exact counts and unchanged input. Chromium checks that opening the Settings report does not change either persisted record.

**Not yet established:** Cross-device accessibility approval, large-workspace performance acceptance, comprehensive parser coverage, legacy-link automatic migration, graph visualization or full GC UI visual acceptance.

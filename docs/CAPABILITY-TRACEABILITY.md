# GoreeCloud Notebook — Vision traceability

**Classification:** planning and product acceptance, not implemented functionality. This mapping relates the [complete 20-domain vision](COMPLETE-FEATURES-AND-CAPABILITIES.md) to workstreams in [Planned Features](PLANNED-FEATURES.md).

| Domain | Group | Roadmap workstreams | Evidence still required |
| --- | --- | --- | --- |
| 01 | Capture | NB-005, NB-006, NB-009 | capture flows, provenance and accessibility |
| 02 | Rich editing | NB-002, NB-007 | format and attachment round-trip |
| 03 | Knowledge organization | NB-006, NB-007 | tree, attributes, archive and recovery |
| 04 | Links and graphs | NB-007 | move/rename/export relationship integrity |
| 05 | Search and retrieval | NB-006, NB-013, NB-014 | privacy and 10k-note search checks |
| 06 | Structured databases | NB-007, NB-015 | typed schema and view consistency |
| 07 | Task management | NB-007, NB-015 | recurrence, reminders and task ownership |
| 08 | Calendar and journal | NB-007, NB-015 | timezones and consent to recording |
| 09 | Visual knowledge | NB-002, NB-015 | keyboard alternative and diagram retention |
| 10 | Collaboration | NB-004, NB-008, NB-015 | authorization and conflict resolution |
| 11 | AI assistance | NB-004, NB-014 | explicit opt-in and scoped note access |
| 12 | Privacy and security | NB-003, NB-004, NB-011 | security review and recovery |
| 13 | Sync and backup | NB-003, NB-008, NB-012 | restore, disconnect and conflict tests |
| 14 | Publishing and sharing | NB-004, NB-015 | private-by-default and revoke access |
| 15 | Automation and APIs | NB-004, NB-014, NB-015 | extension permissions and isolation |
| 16 | Navigation and personalization | NB-002, NB-010 | Glaze 1.7 and device/accessibility tests |
| 17 | Portability | NB-003, NB-005 | ENEX and export round-trip integrity |
| 18 | Specialized note types | NB-007, NB-015 | type-specific safety and preservation |
| 19 | Project productivity | NB-007, NB-015 | cross-project data and governed tasks |
| 20 | Platforms and administration | NB-001, NB-012 | reproducible builds and upgrades |

## Qualification order

1. **Trustworthy foundation (P0):** reproducible source builds, restore tests, Evernote conversion fidelity, access controls and sync reliability. Never use the original notebook as the only test database.
2. **Everyday work (P1):** fast capture, reliable rich editing, hierarchy, search, references and Glaze-based keyboard/touch accessibility.
3. **Advanced vision (P2 until separately scoped):** database views, calendars, visual canvases, team collaboration, publication, integrations and optional AI.

## Evidence rules

Each feature needs its own precise behavior specification, supported-platform decision, accessibility and privacy requirements, security analysis, tests, and confirmation on the current repository head. Underlying TriliumNext source is not GoreeCloud consumer acceptance. Shipping a capability must update [Implemented Features](IMPLEMENTED-FEATURES.md) only after evidence.

Glaze is the one presentation authority, and optional AI must not be necessary for core notes. Embedded task views do not supersede GoreeCloud's governed task-management authority. No encryption, cross-platform, hosting, or publishing promises may be inferred from this vision.

**Coordination record:** Todoist NB-015 within the GoreeCloud Notebook parent; acceptance evidence in GitHub PR and workflow records.

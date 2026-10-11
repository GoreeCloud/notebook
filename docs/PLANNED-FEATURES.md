# Planned capabilities and rebuild backlog

**Owner:** GoreeCloud. **Status:** Active Development; no Stable or production claim.

| ID | Priority | Obligation | Acceptance evidence needed |
| --- | --- | --- | --- |
| NB-001 | P0 | Verify imported tree, license, branch ancestry and package graph | Clean checkout, dependency audit, reproducible build |
| NB-002 | P0 | Glaze 1.7 complete design-system adapter and product UI overhaul | Functional visual/a11y/interaction tests on web, desktop and mobile |
| NB-003 | P0 | Storage, backup, restore and upgrade safety | Realistic copy-based restore and negative tests |
| NB-004 | P0 | Authentication, permission and network threat model | End-to-end access-control and transport tests |
| NB-005 | P2 | Maintain existing ENEX compatibility and safeguards; defer further migration features | Fixture suite preserving resources, links, timestamps, failure handling |
| NB-006 | P0 | Capture inbox, quick add, templates, bulk tag actions and saved search | UX tests plus keyboard and touch acceptance |
| NB-007 | P0 | Note linking, tasks, calendar-oriented notes and attachment management | Data-integrity and portable export tests |
| NB-008 | P1 | Offline and cross-device synchronization robustness | Conflict, reconnect, data-recovery and degraded-state tests |
| NB-009 | P1 | Web clipper provenance and safe page sanitization | Browser compatibility and adversarial content tests |
| NB-010 | P0 | Full GoreeCloud branding, accessible onboarding and localization | Clean-install and upgrade review |
| NB-011 | P1 | Privacy disclosures, support documentation and first-run guidance | Security and documentation reviews |
| NB-012 | P0 | Safe CI, release gating, packaging and rollback | Explicit approved target configuration and exact-head checks |
| NB-013 | P2 | Performance optimization for large notebooks | Reproducible 10k/100k-note benchmarks |
| NB-014 | P2 | Optional future AI assistance with consent and data isolation | Separate privacy and provider-boundary acceptance |
| NB-015 | P1 | Triage the complete 20-domain owner product vision into bounded, prioritized delivery milestones | Traceable capability-to-milestone matrix with feasibility, evidence requirements, privacy/security and Glaze applicability |

## Full vision versus committed execution

The [Complete Features and Capabilities](COMPLETE-FEATURES-AND-CAPABILITIES.md) document defines the broader 20-domain product vision; [Capability Traceability](CAPABILITY-TRACEABILITY.md) maps its domains to current roadmap gates (including databases, visual canvases, collaboration, publishing and integrations). This table contains only the current bounded rebuild obligations, **not** an exhaustive implementation schedule for every proposed capability. Expand milestones and tests through governed planning before claiming delivery; sensitive capabilities such as zero-knowledge storage, shared permissions, AI access, and cross-platform clients require explicit security, architecture and consumer acceptance.

Keep this repository roadmap in Git, with operational follow-up tracked in GoreeCloud's canonical task manager. An item must not be transferred to the implemented file without evidence.

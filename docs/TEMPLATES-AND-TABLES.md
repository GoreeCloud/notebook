# GoreeCloud Notebook — Built-in Templates and Markdown Tables

**Development scope:** Draft Notebook PR #1, first verified November 6, 2026. Implements selected elements of the owner's official Notebook mockup without a new storage schema, remote account, or third-party rich-editor dependency. **Not a Stable release.**

## Templates

Open **Templates** from the left workspace navigation, or select **Use a template** on Home. The four bundled starters are:

| Starter | Purpose | Note type |
| --- | --- | --- |
| Project plan | Overview, goals, milestone table, next steps | note |
| Meeting notes | Participants, agenda, decisions, follow-ups | meeting |
| Daily journal | Personal reflection, gratitude, tomorrow | journal |
| Reading notes | Sources, insights, questions and follow-ups | research |

Each starter contains clearly labeled *prompts or placeholders*, not actual user data or a claimed live project. Merely opening the library does **not** create, overwrite, migrate or save any note. Clicking a starter creates a **new unique note** in the local browser workspace, copies the starter body and tags, focuses the editable title and uses the existing revision-checked IndexedDB autosave. There are no hidden network requests, AI calls, telemetry or remotely fetched starter definitions.

Existing notes, backups and the one-step import recovery checkpoint are not overwritten by opening or selecting a starter. A blocked/stale tab cannot create another note; the existing 5,000-note limit still applies. The product does **not** yet support user-authored reusable templates, template versioning or external template imports.

## Markdown tables

In **Write**, select the real **Insert Markdown table** toolbar control. Notebook inserts a three-column, two-row starter into the editable note *after* the current selection, **without replacing selected text**. Edit the pipe-separated cells in Markdown, then select **Preview**. The project-plan starter already includes a milestone table.

The preview recognizes a limited Markdown subset: pipe-bordered header, a hyphen separator row and subsequent pipe-bordered data rows. It renders semantic `<table>`, `<th scope="col">` and `<td>` elements inside a keyboard-focusable, horizontally scrollable region. Every cell is HTML-escaped before insertion into the UI. To limit parsing and rendering cost, this development preview supports **2–8 columns** and shows at most **64 contiguous data rows per table group**; additional lines are treated as normal Markdown text. A table does not execute HTML, load remote resources, or alter the note schema.

**Limitations:** Not full CommonMark/GFM, escaped pipes within cells, rich cell formatting, nested tables, sort/resize/drag and collaborative editing. Tables use existing autosave and backup controls, so exports contain ordinary Markdown. An editable interactive grid and richer document blocks remain planned.

## Verification and acceptance

GitHub Actions [run #557](https://github.com/GoreeCloud/notebook/actions/runs/42321862958) passed **42 automated tests**, syntax checks, the 16-file allowlisted bundle and Chromium smoke. Model tests verify fresh note identities, template immutability, schema validity, bounded table parsing, accessible headers, non-destructive insertion and malicious HTML escaping. Chromium checks that viewing Templates is read-only; selecting a project starter adds a new saved note without replacing old notes; the milestone table and added table render; unsafe HTML appears as text.

**Unverified:** Firefox/Safari/mobile physical-device acceptance, full WCAG/screen-reader review, actual browser quota exhaustion, storage migrations, richer block editor and complete fidelity to the official founder mockup.

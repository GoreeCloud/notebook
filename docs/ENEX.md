# Evernote ENEX compatibility — text-only development preview

GoreeCloud Notebook supports a conservative migration from standard Evernote ENEX XML files in the web interface (**Import JSON / ENEX**) and local authenticated API endpoint `POST /api/v1/import/enex`. This feature is **not** a lossless Evernote importer.

## Accepted content
- ENEX XML with a known Evernote export3/export4 SYSTEM DOCTYPE, which is stripped before parsing. No external DTD is fetched.
- Note title, creation/update timestamps, tags, and basic ENML text extracted into Markdown-like text.
- Up to 8 MiB XML, 2,000 notes, 20 tags per note and the canonical Notebook field limits. Each import creates a new “Evernote Import” notebook; existing notes are never overwritten.
- Dry-run first, then explicit confirmation for an append-only transaction. ENEX text imported twice creates duplicates.

## Loss and security boundaries
- Attachments and `en-media` are **not imported**. An ENEX file containing media fails by default. The user must explicitly acknowledge omission with `skip_resources=true` (or via the browser's separate confirmation) before importing any text from such a file.
- Complex ENML formatting, CSS, tables, diagrams, OCR, embedded PDFs, rich internal links, reminders, notebook nesting, and special metadata are **not preserved**. Keep the original ENEX intact.
- Entities, unexpected doctypes, malformed XML and invalid dates are rejected. HTML-like tags do not execute; script/style/iframe content is omitted, and ENML is rendered to text, not raw browser HTML.
- No remote network lookup, automatic cloud upload, file attachment extraction, E2EE or tested recovery from lost devices.
- This importer is designed for controlled local migration, not untrusted multiuser file upload services.

Official reference formats: [Evernote ENEX export guide](https://help.evernote.com/hc/en-us/articles/209005557-Export-Notes-and-Notebooks-as-ENEX-or-HTML) and [ENEX specification overview](https://evernote.com/blog/how-evernotes-xml-export-format-works). These third-party formats are not included as code. Source tests are under `server/tests/test_enex.py`.

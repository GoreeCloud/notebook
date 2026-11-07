# GoreeCloud Notebook — Markdown Editor and Navigation Guide

**Status:** Implemented in the open development-preview PR, **not** a complete WYSIWYG editor or Stable release. The founder's visual reference is documented in [Official Mockup](OFFICIAL-MOCKUP.md).

## Working editor toolbar

When editing a local note, the toolbar above the title provides seven functional commands:

| Control | Saved Markdown | Behavior |
| --- | --- | --- |
| Heading | `## Heading` | Prefixes the current line |
| Bold | `**text**` | Wraps selection or selects a placeholder |
| Italic | `*text*` | Wraps selection or selects a placeholder |
| Bulleted list | `- text` | Prefixes selected lines |
| Checklist | `- [ ] text` | Prefixes selected lines |
| Block quote | `> text` | Prefixes selected lines |
| Inline code | Backticks around selected text | Wraps selection or selects a placeholder |

**Keyboard shortcuts:** Ctrl/Cmd+B for bold, Ctrl/Cmd+I for italic while the note body has focus. Controls use native buttons with labels and preserve the textarea selection. All modifications use the existing revision-checked debounced IndexedDB autosave path, with size limits and stale-tab read-only protections. The formatting helper is pure and has no dependencies.

**Write / Preview:** Write uses an accessible native textarea. Preview escapes untrusted note text before rendering a **limited Markdown subset**: headings, bold, italic, list lines, interactive checkboxes, block quotes, inline code and local wiki links. A checked preview checkbox updates **one validated Markdown line**, then autosaves locally. There is no remote renderer, script execution or arbitrary HTML support. The preview is not CommonMark-complete; combinations of formatting markers may be handled imperfectly.

**Not yet delivered:** Rich contenteditable/block editing, tables, cover-image uploads, image attachments and thumbnails, undo/redo toolbar, full Markdown/CommonMark compliance, media embeds, complete native rich-text accessibility review, and the rest of the mockup's advanced controls.

## Working workspace navigation

- **Home** and **Notes:** dashboard and all local active notes, including nested notes.
- **Notebooks:** shows existing **top-level notes** as containers. A dedicated notebook entity, folder creation/rename, collapsible notebook grouping and notebook-specific permissions are **not yet implemented**; the view states this explicitly.
- **Tags:** sidebar tags and a filterable Tags list are populated from actual local notes. Selecting a tag filters active notes by exact case-insensitive tag; no server requests or hidden user data.
- **Recent:** up to 24 most recently edited active notes.
- **Favorites, My tasks, Archive and Trash:** previously supported local collections.

Tags and view selections are ephemeral navigation state; they do not change the persisted note format. Opening a note uses the existing editor and respects saved content.

## Data safety and verification

The scope of this addition does **not** alter the schema or migrate IndexedDB data. The browser retains its single-snapshot revision checks, cross-tab warnings, automatic save, backup import/export, recovery checkpoint and guarded failure handling. The PWA and allowlisted static bundle now include `src/formatting.js` for offline access.

Pure unit tests cover selection formatting, line boundaries, empty selections, invalid commands, note size limits, single-line checklist toggles and non-mutation. Chromium exercises actual toolbar clicks, Ctrl+I, preview output, checkbox persistence, filtered tags, top-level notebook navigation and Recent while retaining the existing storage, backup and offline tests.

Any future conversion to a structured rich-document model needs an explicit migration and rollback plan, recovery verification, platform/assistive-technology testing, GC UI design acceptance and separate release authorization.

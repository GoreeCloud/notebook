# GoreeCloud Notebook — Official Owner-Provided UI Mockup

**Authority:** Official product mockup supplied directly by the GoreeCloud founder on **November 6, 2026**. This document describes **visual direction**, not a claim that the pictured features are already implemented.

**Private source image:** `GoreeCloud/Projects/GoreeCloud Notebook/OFFICIAL-NOTEBOOK-UI-MOCKUP.png` (private Drive reference; no public link embedded), stored in the authorized canonical GoreeCloud Notebook project folder. Do not publish the image to the public GitHub repository or external image hosts without separate approval.

## Screen description — founder reference

The supplied desktop mockup shows a polished, light visual treatment with a white canvas, subtle dividers, rounded controls, and a **distinct green Notebook accent**. The UI is organized into:

1. **Left workspace sidebar:** Notebook symbol and **Notebook** wordmark, strong green **New Note** split-style control, Home, Notes, Notebooks, Tags, Favorites, Recent, Templates and Trash; notebook folder tree and tag chips below.
2. **Middle note list:** “All Notes” heading, note count, sort/view affordances, stacked selectable notes showing title, excerpts, tag pills, edit time, optional thumbnails, and a soft green selected state.
3. **Right note canvas:** compact formatting toolbar; breadcrumb path, wide image cover, prominent note title, notebook and tag chips, edited timestamp, formatted headings, a highlighted callout, goals list, interactive task checkboxes, table, and block-entry prompt.
4. **Global header:** long search field, shortcut hint and right-aligned notifications/help/profile affordances.

**Owner-specified composition and visual hierarchy** are binding design direction for the Notebook product. The mockup does not supply exact font files, CSS variables, spacing measurements, interaction contracts, backend services, or a native-device layout, so those must be designed and tested against the current **GoreeCloud UI** foundational design authority; do not invent an official token set.

### Example content is illustrative, not actual user data

“Project Planning”, “Project Alpha”, “Meeting Notes”, the 42-note count, dates, checklist rows, imagery, tags and project timeline are **sample content** in the mockup. Never prepopulate a real user workspace with these examples or represent their statuses as genuine.

## Implementation matrix (v0.1 draft PR)

| Owner-mockup element | Existing implementation | Next step |
| --- | --- | --- |
| Three-pane desktop workspace | Existing sidebar, note list and editor | Bring panel proportions, visual density and selected state closer to screenshot |
| Light canvas and Notebook green accent | Existing GC UI Foundation 1.0.1 light/dark tokens and product CSS | Use the official light mockup as initial visual direction while retaining optional dark/high contrast; ensure control contrast |
| Navigation, notebooks, tags and tree | Working Home, Notes, top-level note-container **Notebooks**, **Tags** with filters, Favorites, **Recent**, Tasks, Archive, Trash and nested notes | Dedicated notebook entity, notebook management, Templates, advanced tag collections and notebook permissions remain planned |
| Selectable note cards | Existing list with title, tag text, excerpt and modified date | Add tag pills, optional visuals and richer selection states after model/a11y checks |
| Rich document canvas | Native Markdown textarea with **working formatting toolbar**, Ctrl/Cmd+B/I, safe preview, native interactive checklist toggles, quote and inline code rendering, title/parent/tags | Dedicated rich block/WYSIWYG editor, tables, image covers, attachments, breadcrumbs, history and full formatting still planned |
| Global search | Existing local search over title/body/tags | Expand to notebooks, saved filters and keyboard shortcuts with testing |
| User account / notifications | Not present; local-first preview | Do not add fake online-account, notification, or cloud affordances |
| Responsive / accessibility | Basic mobile view and Chromium checks | Verify tablet/mobile compositions, keyboard/screen-reader and contrast against official reference |

## Delivery boundaries

- Preserve data protection: IndexedDB revision checks, autosave, import recovery, privacy-first local operation and portable backup controls are mandatory.
- The shared GC UI Foundations stylesheet remains pinned and attributed. Notebook-specific **green accent** comes from the founder's product mockup; the founder screenshot's green is approximately `#1e8b2d` in its New Note button. Interactive foregrounds may use a **darker accessibility-adjusted variant**, not an unverified claim of an official brand color.
- Use actual working behavior for controls; do not build dead formatting buttons, pretend collaboration exists or imitate a real account identity when none is configured.
- Treat each implementation and rendered verification separately. Source changes or screenshot similarity do not establish full rich-editor capability or a production release.

**Implementation status (foundation + functional editor pass):** The official mockup is stored privately; the open Notebook draft PR now uses **light mode for new workspaces**, a green Notebook icon and primary actions, a wider three-pane desktop layout, a white editor canvas, and real list excerpts/tag chips/timestamps. Existing users' saved dark-mode preference remains respected, and GC UI Foundations remain pinned. Chromium screenshots and automated interaction checks are used to verify this first pass. The resulting interface is **not yet pixel-equivalent** to the supplied reference: cover images, full rich editing, notebook/tag navigation, notifications and profiles have not been built. No merge, production deployment or Stable release.

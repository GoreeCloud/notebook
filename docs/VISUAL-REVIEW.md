# GoreeCloud Notebook — Rendered UI Review Evidence

**Date:** November 6, 2026  
**Scope:** Local-first v0.1.0 browser development preview  
**Status:** Partial screenshot-led review performed; **not** full GC UI visual acceptance, cross-browser certification, or production approval.

## Source authority

- Founder-approved GC UI rules: `GoreeCloud/gc-ui/docs/DESIGN_LANGUAGE.md` and `docs/COMPONENTS.md`.
- Notebook source: `GoreeCloud/notebook`, draft PR #1 (`feat/notebook-local-first-foundation-20261106`).
- All captures use **generated synthetic notes from the browser smoke test**. No personal workspace data was captured.

## Actual rendered screenshots

1. [Before: CI run #117](https://github.com/GoreeCloud/notebook/actions/runs/42249140184), artifact `notebook-ui-review`, ID `13518293981`, from commit `f2e9e73c786baa76252b83f112463c58e8267aa1`.
2. [After: CI run #127](https://github.com/GoreeCloud/notebook/actions/runs/42249748922), artifact `notebook-ui-review`, ID `13520210335`, from commit `03126b5147c9c50c9b790f276cbcfffb28aff840`.

The first two artifacts contain six PNG renders: `home-dark-desktop.png`, `editor-dark-desktop.png`, `editor-light-desktop.png`, `home-light-desktop.png`, `home-light-mobile.png` and `editor-light-mobile.png`. Viewports: **1440 × 900 desktop** and **390 × 844 mobile** in headless Chromium. A third [expanded CI run #146](https://github.com/GoreeCloud/notebook/actions/runs/42252574578), artifact `notebook-ui-review` ID `13519958829`, adds `editor-light-small-mobile.png` at **320 × 640** and `editor-light-tablet.png` at **768 × 1024**. Both additional screenshots were inspected; the narrow mobile note heading remains readable, and the tablet editor displays its library and editor without horizontal overflow. GitHub Actions screenshots are temporary artifacts, currently configured for **7-day retention**, not immutable release records.

## Observations and improvements

| UI element | Before | Corrective action | Verified afterward |
| --- | --- | --- | --- |
| New-note icon on mobile and desktop | Fullwidth Unicode plus sometimes rendered as a missing-glyph rectangle | Replaced unsupported fullwidth plus with standard, supported `+` | Plus appears clearly in desktop and mobile screenshots |
| Mobile note-heading editor | A long heading was clipped to one line in a narrow viewport | Converted title editor to an auto-height, wrapping textarea; normalized pasted line breaks | Heading now wraps to two readable lines at 390px; Chromium checks no title overflow |
| Home dashboard | Distinct hero, semantic cards, clear CTA and hierarchy | Retained existing layout, responsive spacing and dark/light contrast strategy | Captured and inspected both desktop modes and light mobile; no observed horizontal overflow |
| Note editor | Desktop shows sidebar, note list, editor and action row; mobile stacks list and editor | Retained structured panel layout and touch-oriented bottom navigation | Captured and inspected desktop light/dark and mobile light views |

### Browser verification

- `scripts/cdp-smoke.mjs` captures the six screenshots in CI from temporary browser data.
- The browser screenshot steps check for horizontal overflow at desktop, tablet, 390px mobile and 320px mobile; the heading editor must not clip or scroll horizontally/vertically on the tested mobile widths.
- This test runner also exercises IndexedDB autosave, stale-tab conflict rejection, import rollback, task controls, archive/trash, search, stable links, keyboard shortcuts and the offline PWA shell.

## Latest GC UI Foundations integration screenshots

- [GitHub Actions #311](https://github.com/GoreeCloud/notebook/actions/runs/42303256940), `notebook-ui-review` artifact **13545261147** (temporary, 7-day retention) contains eight current synthetic desktop, tablet and mobile screenshots after the pinned Foundations 1.0.1 stylesheet was enabled.
- The current `home-dark-desktop.png` shows the dark GC UI canvas, high-contrast purple-iris primary controls, distinct sidebar and deliberate dark hero. `home-light-mobile.png` shows canonical light surfaces and a five-item bottom navigation without observed horizontal overflow at 390px.
- The current `editor-light-mobile.png` shows a wrapped note heading, keyboard/touch controls and native form fields with a readable layout at 390px. Automated smoke checks canonical light/dark primary values, system-driven high-contrast palette switching and narrow layout overflow. The high-contrast switch was tested in Chromium run #326, but its full rendered accessibility and contrast acceptance remains open.
- **Assessment:** These specific screenshots demonstrate a coherent partial foundation integration. The product still includes custom navigation, components, icon glyphs and decorative colors. This is neither a full GC UI component migration nor a finished visual-quality/assistive-technology acceptance review. See [GC UI Adoption](GC-UI-ADOPTION.md) for provenance and limits.

## Owner-official mockup — initial implementation review (November 6, 2026)

The founder supplied the official Notebook workspace mockup, preserved privately in the private canonical `GoreeCloud/Projects/GoreeCloud Notebook/` folder. Design decisions and remaining functional gaps are documented in [Official Mockup](OFFICIAL-MOCKUP.md).

- [GitHub Actions #443](https://github.com/GoreeCloud/notebook/actions/runs/42318251197) succeeded after the mockup's first alignment pass. Its `notebook-ui-review` artifact ID `13552165750` contains eight correctly labeled light/dark desktop, tablet and mobile synthetic screenshots. Screenshots are temporary and do **not** contain user data.
- **Verified in source and review:** the first screen now defaults to light for a new workspace, Notebook's emblem and primary actions have a green product accent, a wider middle note list shows real excerpts, tags and timestamps when present, and the desktop editor retains a usable dedicated pane. Existing GC UI Foundations tokens, dark-mode option, keyboard focus and storage safeguards remain.
- **Still different from the official reference:** the demo screenshot's rich-document toolbar, cover photo, image thumbnails, tables, formatted checklists, dashboard navigation categories and account/notification controls are not implemented. The current editor is a Markdown textarea plus a safe subset preview; these mockup elements must become working, accessible features before they can be presented as available. No fake user/project records are shipped.
- **Acceptance boundary:** this is a verified first-pass stylistic direction, not pixel-equivalent mockup reproduction, full GC UI 100-principle acceptance, screen-reader acceptance, or a stable release.

## Outstanding visual and experience checks

- Compare every screen and state with the **complete** founder-approved 100 GC UI principles and actual canonical design tokens/components; local fallback colors are **not** the canonical palette contract.
- Test settings dialogs, backup-recovery confirmation, conflict warnings, empty/error/loading states, alternate widths, high DPI, focus behavior and screen-reader navigation.
- Test Android, iOS, desktop, Firefox, Safari/WebKit and installed PWA variants; current screenshots cover Chromium only.
- Validate readable touch-target dimensions, contrast, accessibility preferences, reduced motion and keyboard-only interaction.
- Retain longer-lived visual evidence when release review requires it.

**Release boundary:** This targeted rendered review confirms two corrected defects and a reasonably coherent current screen layout. It does not establish whole-product visual acceptance or a stable release.

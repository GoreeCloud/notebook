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

## Outstanding visual and experience checks

- Compare every screen and state with the **complete** founder-approved 100 GC UI principles and actual canonical design tokens/components; local fallback colors are **not** the canonical palette contract.
- Test settings dialogs, backup-recovery confirmation, conflict warnings, empty/error/loading states, alternate widths, high DPI, focus behavior and screen-reader navigation.
- Test Android, iOS, desktop, Firefox, Safari/WebKit and installed PWA variants; current screenshots cover Chromium only.
- Validate readable touch-target dimensions, contrast, accessibility preferences, reduced motion and keyboard-only interaction.
- Retain longer-lived visual evidence when release review requires it.

**Release boundary:** This targeted rendered review confirms two corrected defects and a reasonably coherent current screen layout. It does not establish whole-product visual acceptance or a stable release.

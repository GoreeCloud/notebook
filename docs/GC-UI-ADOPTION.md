# GoreeCloud Notebook — GC UI Foundations Adoption

**Date:** November 6, 2026  
**Status:** Foundation-level integration implemented in the draft Notebook PR; **full GoreeCloud UI visual acceptance pending**.

## Authorities and provenance

- Founder-approved design authority: `GoreeCloud/Projects/GoreeCloud UI/DESIGN-LANGUAGE-AND-100-UI-UX-PRINCIPLES.md`, supported by `GoreeCloud/gc-ui/docs/DESIGN_LANGUAGE.md` and `docs/COMPONENTS.md`.
- **Pinned original source:** `GoreeCloud/gc-ui`, tag [`foundations-v1.0.1`](https://github.com/GoreeCloud/gc-ui/releases/tag/foundations-v1.0.1), stylesheet `styles/gc.v1.generated.css`.
- Vendored exact-copy path: `assets/gc-ui-foundations.v1.css`, source Git blob SHA-1 `c0e32a40f0bba280c9a4e9e01f31e1114d60f26c`.
- License: **Apache License 2.0**, exact upstream text at `licenses/GC-UI-APACHE-2.0.txt`, source Git blob SHA-1 `ff9ad4530f5716304e042cbac72cecd7c40f0e0e`.
- `THIRD_PARTY_NOTICES.md` records the source, license and independent app license. Notebook remains MIT; copying the upstream stylesheet does **not** transfer its license to MIT.
- No npm install, remote CSS, hosted fonts, predecessor design-system code or alpha component modules were introduced.

## Implemented scope

1. `index.html` loads the exact pinned GC UI CSS **before** Notebook's local `assets/styles.css`. All styles stay local and within the current CSP.
2. Notebook's existing `--gc-brand`, surface, text, outline, success, danger, radius, spacing-relevant motion and typography values now resolve through the versioned `--gc-v1-*` Foundation properties. This is a **compatibility bridge**, not a rewrite of the existing UI.
3. `src/app.js` now synchronizes `data-gc-mode` alongside the persisted Notebook `data-theme`, so the upstream light/dark palettes actually switch. Initial HTML now selects the owner's **official light Notebook mockup** appearance for new workspaces; existing users' persisted dark choice remains respected. It also tracks the operating system's `(prefers-contrast: more)` preference through `data-gc-contrast`, applying the released high-contrast palette without rewriting user settings or note content.
4. `sw.js` caches the new CSS with its allowlisted shell and increments the cache version to avoid retaining an obsolete theme.
5. The review-only `dist/` now includes the pinned stylesheet, MIT `LICENSE`, the Apache-2.0 license and attribution notice. The static bundle excludes `test/`, `scripts/` and other authoring material.
6. Tests verify the vendored file's **exact Git blob SHA**, license, token bridge, light/dark DOM-mode switching, canonical keyboard focus-ring styles, system high-contrast preference changes and offline/static package requirements (GitHub Actions run #326 passed the preference regression).

## Explicit limits

- Notebook retains product-specific layouts, copy, components and some purposeful hard-coded decorative colors (such as the dashboard hero). The official owner's Notebook mockup authorizes a **Notebook-only green accent** (a screenshot-derived, contrast-adjusted `--notebook-accent` variable); it does not modify or counterfeit the pinned upstream GC UI `--gc-v1-*` tokens. Only the mapped semantic foundation roles are certified as drawn from this upstream release.
- The upstream experimental component library, full 100-principle review, complete high-contrast interaction and screen-reader audits, plus product-wide responsive/visual acceptance **are not yet completed**. The automatic system high-contrast palette change is tested but does not establish full high-contrast acceptance.
- The upstream project's `package.json` can describe the wider monorepo as `0.2.0-alpha.1`. The **Foundations 1.0.1 release tag**, rather than that monorepo package's development version, identifies the pinned released CSS and license.
- GC UI may update later. Source upgrades must be explicitly reviewed, re-pinned, relicensed as appropriate and tested before replacing the vendored copy. No automatic CDN, npm or background updates are implied.

## Verification checklist

- Confirm the exact-copy hashes and license tests pass.
- Confirm Chromium renders both light and dark primary/canvas tokens, and that the new theme switch retains persisted Notebook behavior.
- Confirm `npm run build:release` includes all required assets and notices, never ships destructive fixture pages, and PWA offline shell loads the new stylesheet.
- Inspect new rendered desktop/mobile screenshots for composition, contrast, typography, density, focus and legibility; assess against founder-approved design references. **Do not mark full visual acceptance from source tests alone.**

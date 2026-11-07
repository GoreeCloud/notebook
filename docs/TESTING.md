# GoreeCloud Notebook — Browser Test Isolation and Quota Evidence

**Date:** November 6, 2026. **Status:** Development-preview test record, not production certification.

## Test-fixture safety

`test/browser-smoke.html` and `test/quota-smoke.html` can write or replace browser-local Notebook snapshots and checkpoints. Because a static host may accidentally publish repository test files, they refuse to start unless **all** are true:

- Scheme is `http:`.
- Hostname is exactly `127.0.0.1`.
- Query parameter `notebook-smoke` matches a **fresh random token injected into that page by the local Chromium DevTools runner**. The token is generated per test session and is not hardcoded in the repository.

The CI runner injects a random per-session token with DevTools before navigation, and then supplies that token as the URL marker in its disposable Chromium profile. Opening either page on a normal development/static host without the runner injection fails before local storage access, even if a URL parameter is guessed. This is a **defense against accidental or unauthenticated test execution**, not application authentication; the runner should never be used with real user data, and release deployments should exclude `test/` and `scripts/` entirely.

The regular Chromium suite verifies that unmarked fixture URLs refuse to execute. Both fixture scripts also refuse a guessed marker unless the private runner-injected token matches. No note, account, production server, or real user browser profile is used for these tests.

## Existing verified tests

The required CI suite runs `npm run check`, `npm test`, and the Chromium browser smoke in a disposable profile. The **34 Node tests** cover model, backup, formatting/checklist, link integrity, import-impact and pinned GC UI Foundations behavior. Chromium verifies real toolbar clicks, Ctrl/Cmd shortcuts, preview/checklist persistence, Tags/Recent/top-level Notebooks navigation, revision conflicts, backups (bounded gzip), invalid imports, one-step undo, simulated synchronous quota errors, cached-shell reopening, high-contrast/green mobile-brand assertions and responsive layouts. All browser fixtures use synthetic notes, never user workspaces.

## Experimental quota enforcement

Chromium's experimental DevTools command `Storage.overrideQuotaForOrigin` reports an active origin quota override, but on the GitHub Actions Chromium runner the IndexedDB write was **not** rejected for test payloads of approximately **3.6 MB** or **27 MB**. Those experiments failed as desired tests; they do **not** prove the application's behavior under real storage exhaustion.

- Historical failing CI: [run #240](https://github.com/GoreeCloud/notebook/actions/runs/42299040503) and [run #242](https://github.com/GoreeCloud/notebook/actions/runs/42299278986).
- `test/quota-smoke.html` remains as a guarded **experimental** fixture.
- Opt in only with `NOTEBOOK_QUOTA_EXPERIMENT=1 npm run test:browser` on a trusted local test installation; this may fail and is **not** part of the required CI gate until reproducible.
- The synthetic `IDBObjectStore.put` quota exception regression is still required and passing, but it is not a substitute for the browser quota manager.

A device-level true-quota test should use an isolated profile and a controlled storage budget, ensure the failure occurs, check both the saved workspace and recovery checkpoint, and avoid operating-system disk exhaustion or other destructive experiments on shared devices.

## Verified release-candidate staging

`npm run build:release` copies an explicit allowlist of **eleven PWA runtime assets** plus MIT `LICENSE`, the upstream Apache-2.0 license and `THIRD_PARTY_NOTICES.md` into a new `dist/`. The pure `src/formatting.js` helper is included in the offline and release allowlists. The script refuses to overwrite an existing `dist/`, verifies source paths are regular files, stages into a temporary directory and renames that directory only when every copy succeeded. CI verifies exactly **fourteen** resulting files with byte-for-byte comparisons and checks that no `test/`, `scripts/`, or `docs/` directory is included. No external dependency, upload, hosting or deployment is performed.

The development HTTP server is bound to `127.0.0.1` by default. Reviewing or testing `dist/` is not equivalent to approving a production launch. Any future release review must use the intended hosting controls, validate actual service worker behavior at that scope, and retain rollback options.

## Release and distribution requirements

- Never deploy or expose destructive test fixtures as a documented feature.
- Ship only the application assets required by the allowlisted service worker.
- Keep import/export tests separate from real private Notebook profiles.
- Report exact test environment and outcomes. A passing browser smoke test does not establish certified multi-browser quota recovery or native-device acceptance.

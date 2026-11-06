# GoreeCloud Notebook — Browser Test Isolation and Quota Evidence

**Date:** November 6, 2026. **Status:** Development-preview test record, not production certification.

## Test-fixture safety

`test/browser-smoke.html` and `test/quota-smoke.html` can write or replace browser-local Notebook snapshots and checkpoints. Because a static host may accidentally publish repository test files, they refuse to start unless **all** are true:

- Scheme is `http:`.
- Hostname is exactly `127.0.0.1`.
- Query string contains `notebook-smoke=enabled`.

The CI runner supplies this explicit marker only for the intended disposable Chromium profile. Opening either page without it fails before local storage access. This is a **guard against accidental execution**, not an authorization system; the test runner should not be used with real user data, and release deployments should exclude `test/` and `scripts/` entirely.

The regular Chromium suite verifies that unmarked fixture URLs refuse to execute. No note, account, production server, or real user browser profile is used for these tests.

## Existing verified tests

The required CI suite runs `npm run check`, `npm test`, and the Chromium browser smoke with a temporary profile. It covers note editing, revision conflicts, search, hierarchy, backups (including bounded gzip), invalid imports, one-step undo, simulated synchronous quota errors, offline shell reopening, and responsive layouts. Tests use synthetic notes.

## Experimental quota enforcement

Chromium's experimental DevTools command `Storage.overrideQuotaForOrigin` reports an active origin quota override, but on the GitHub Actions Chromium runner the IndexedDB write was **not** rejected for test payloads of approximately **3.6 MB** or **27 MB**. Those experiments failed as desired tests; they do **not** prove the application's behavior under real storage exhaustion.

- Historical failing CI: [run #240](https://github.com/GoreeCloud/notebook/actions/runs/42299040503) and [run #242](https://github.com/GoreeCloud/notebook/actions/runs/42299278986).
- `test/quota-smoke.html` remains as a guarded **experimental** fixture.
- Opt in only with `NOTEBOOK_QUOTA_EXPERIMENT=1 npm run test:browser` on a trusted local test installation; this may fail and is **not** part of the required CI gate until reproducible.
- The synthetic `IDBObjectStore.put` quota exception regression is still required and passing, but it is not a substitute for the browser quota manager.

A device-level true-quota test should use an isolated profile and a controlled storage budget, ensure the failure occurs, check both the saved workspace and recovery checkpoint, and avoid operating-system disk exhaustion or other destructive experiments on shared devices.

## Release and distribution requirements

- Never deploy or expose destructive test fixtures as a documented feature.
- Ship only the application assets required by the allowlisted service worker.
- Keep import/export tests separate from real private Notebook profiles.
- Report exact test environment and outcomes. A passing browser smoke test does not establish certified multi-browser quota recovery or native-device acceptance.

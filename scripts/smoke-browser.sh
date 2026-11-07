#!/usr/bin/env bash
# Compatibility entrypoint. The former HTML-dump probe was unreliable for IndexedDB.
set -euo pipefail
exec node scripts/cdp-smoke.mjs

#!/usr/bin/env bash
set -euo pipefail
PORT=4179
TMP="$(mktemp -d)"
SERVER_PID=""
CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then
  echo "A headless Chromium-compatible browser is required for this smoke test." >&2
  exit 1
fi
cleanup() {
  if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT
python3 -m http.server "$PORT" --bind 127.0.0.1 >"$TMP/http.log" 2>&1 &
SERVER_PID=$!
python3 - <<'PY'
import time, urllib.request
for _ in range(70):
    try:
        urllib.request.urlopen("http://127.0.0.1:4179/", timeout=1).close()
        break
    except Exception:
        time.sleep(.1)
else:
    raise SystemExit("Test HTTP server did not start.")
PY
"$CHROME" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --no-first-run --no-default-browser-check --disable-background-networking \
  --user-data-dir="$TMP/profile" --virtual-time-budget=16000 \
  --dump-dom "http://127.0.0.1:$PORT/test/browser-smoke.html" >"$TMP/dom.html" 2>"$TMP/chrome.log" || {
    cat "$TMP/chrome.log" >&2
    exit 1
  }
if ! grep -q 'data-test-result="PASS"' "$TMP/dom.html"; then
  echo "Browser smoke failed or did not complete:" >&2
  grep -o 'FAIL:[^<]*' "$TMP/dom.html" | head -5 >&2 || true
  tail -35 "$TMP/chrome.log" >&2
  exit 1
fi
echo "Notebook browser smoke passed."

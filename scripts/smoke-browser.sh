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
  python3 - "$TMP/dom.html" <<'PY'
import html, re, sys
source = open(sys.argv[1], encoding="utf-8").read()
all_results = re.findall(r'<pre id="output">([\s\S]*?)</pre>', source)
print("DOM test output:", html.unescape(all_results[-1])[-2800:] if all_results else "No <pre id=output> found")
print("HTML state:", re.search(r'<html[^>]*>', source).group(0) if '<html' in source else "No HTML root")
PY
  tail -8 "$TMP/chrome.log" >&2
  exit 1
fi
echo "Notebook browser smoke passed."

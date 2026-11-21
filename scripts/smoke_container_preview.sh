#!/usr/bin/env bash
# Explicit disposable rootless Podman test on an authorized local host.
# Test names and the SQLite volume are unique. No real Notebook data is read.
set -euo pipefail
command -v podman >/dev/null || { echo "Podman required" >&2; exit 2; }
image="localhost/goreecloud-notebook:local-preview"
podman image exists "$image" || { echo "Build local-preview image first" >&2; exit 2; }
name="gcnb-smoke-$PPID-$$"
volume="$name-data"
if podman container exists "$name" || podman volume exists "$volume"; then
  echo "Refusing a collision with existing Podman resources" >&2
  exit 2
fi
cleanup() {
  podman rm -f "$name" >/dev/null 2>&1 || true
  podman volume rm "$volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT
podman volume create "$volume" >/dev/null
GC_NOTEBOOK_TOKEN="$(python3 -c 'import secrets;print(secrets.token_urlsafe(40))')"
export GC_NOTEBOOK_TOKEN
podman run -d --name "$name" --user 10001:10001 --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m \
  --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 128 --memory 512m \
  --volume "$volume:/data:U" \
  --publish 127.0.0.1::8000 --env GC_NOTEBOOK_TOKEN \
  "$image" >/dev/null
published="$(podman port "$name" 8000/tcp)"
if [[ "$published" != 127.0.0.1:* ]]; then
  echo "Refusing unexpectedly non-loopback port" >&2
  exit 3
fi
port="$(printf '%s' "$published" | cut -d: -f2)"
export GC_NOTEBOOK_BASE="http://127.0.0.1:$port"
for iteration in $(seq 1 40); do
  if podman container inspect --format '{{.State.Running}}' "$name" | grep -qx false; then
    echo "Notebook container exited during startup" >&2
    exit 4
  fi
  if python3 - <<'PY'
import os,urllib.request
try:
    urllib.request.urlopen(os.environ["GC_NOTEBOOK_BASE"]+"/health",timeout=1).read()
except Exception:
    raise SystemExit(1)
PY
  then break; fi
  sleep 0.25
done
python3 - <<'PY'
import json,os,urllib.error,urllib.request
root=os.environ["GC_NOTEBOOK_BASE"]
secret=os.environ["GC_NOTEBOOK_TOKEN"]
with urllib.request.urlopen(root+"/health",timeout=3) as response:
    assert response.status==200 and json.load(response)["ok"]
try:
    urllib.request.urlopen(root+"/api/v1/notebooks",timeout=3)
    raise AssertionError("Unauthenticated request unexpectedly succeeded")
except urllib.error.HTTPError as exc:
    assert exc.code==401
def call(path,method="GET",payload=None):
    data=json.dumps(payload).encode() if payload is not None else None
    request=urllib.request.Request(
        root+path,method=method,data=data,
        headers={"Authorization":"Bearer "+secret,"Content-Type":"application/json"}
    )
    with urllib.request.urlopen(request,timeout=3) as response:
        return json.load(response)
books=call("/api/v1/notebooks")
assert len(books)==1
new=call("/api/v1/notes","POST",
         {"notebook_id":books[0]["id"],"title":"Synthetic container smoke",
          "body":"Private synthetic test only"})
assert new["title"]=="Synthetic container smoke"
summary=call("/api/v1/notes/page?summary=true")
assert len(summary["results"])==1
assert summary["results"][0]["id"]==new["id"]
assert "body" not in summary["results"][0]
full=call("/api/v1/notes/"+new["id"])
assert full["body"]=="Private synthetic test only"
print("PASS: loopback-only, bearer-required, isolated SQLite volume, full/summary API")
PY
podman exec -i "$name" python3 - <<'PY'
import os
assert os.geteuid()==10001
assert os.environ["GC_NOTEBOOK_DB"]=="/data/notes.sqlite3"
assert not os.access("/opt/goreecloud/notebook",os.W_OK)
assert os.path.isfile("/data/notes.sqlite3")
print("PASS: non-root UID, read-only application root, isolated SQLite store")
PY
echo "PASS: cleanup will remove only the named disposable container and volume"

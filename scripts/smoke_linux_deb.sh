#!/usr/bin/env bash
set -euo pipefail
if [[ $# -ne 1 ]]; then
  echo "usage: $0 /path/to/goreecloud-notebook_*.deb" >&2
  exit 2
fi
PACKAGE="$1"
test -f "$PACKAGE"
STAGE="$(mktemp -d)"
trap 'rm -rf -- "$STAGE"' EXIT
dpkg-deb --extract "$PACKAGE" "$STAGE"
APP="$STAGE/opt/goreecloud/notebook"
test -f "$APP/vendor/PySide6/QtCore.abi3.so"
test -f "$APP/server/notebook/store.py"
test -x "$STAGE/usr/bin/goreecloud-notebook"
# Isolate test data in a disposable temp tree, never user production notes.
QT_QPA_PLATFORM=offscreen GC_NOTEBOOK_SMOKE=1 \
  XDG_DATA_HOME="$STAGE/local-test-data" \
  GC_NOTEBOOK_PACKAGE_ROOT="$APP" \
  "$STAGE/usr/bin/goreecloud-notebook"
test -f "$STAGE/local-test-data/goreecloud/notebook/notes.sqlite3"
echo "PASS: extracted native Qt Quick .deb launched with isolated test database"

#!/usr/bin/env bash
# Read-only inspection of a locally installed *debug* Notebook app database.
# No seed records, app-data exports, local secrets, install or device mutation.
set -euo pipefail
if [[ $# -ne 1 || -z $1 ]]; then
  echo "usage: bash scripts/verify_android_schema.sh <explicit-adb-serial>" >&2
  exit 2
fi
serial="$1"
adb_bin="${ADB:-adb}"
if ! "$adb_bin" -s "$serial" get-state 2>/dev/null | grep -qx device; then
  echo "The explicitly selected Android device is not authorized/connected." >&2
  exit 2
fi
if ! "$adb_bin" -s "$serial" shell pm path com.goreecloud.notebook 2>/dev/null | grep -q '^package:'; then
  echo "GoreeCloud Notebook is not installed." >&2
  exit 2
fi
sql='PRAGMA user_version; SELECT count(*) FROM notebooks; SELECT count(*) FROM notes; SELECT count(*) FROM revisions;'
rows="$("$adb_bin" -s "$serial" shell "run-as com.goreecloud.notebook /system/bin/sqlite3 databases/notebook.db \"$sql\"")"
if [[ "$rows" == *Error:* ]]; then
  echo "Notebook schema cannot be read; debug run-as is required." >&2
  exit 2
fi
printf '%s\n' "SQLite version, notebook count, note count, revision count:" "$rows"
integrity="$("$adb_bin" -s "$serial" shell 'run-as com.goreecloud.notebook /system/bin/sqlite3 databases/notebook.db "PRAGMA foreign_key_check;"')"
if [[ -n "$integrity" ]]; then
  echo "Foreign-key integrity failed; preserve the device and investigate privately." >&2
  exit 1
fi
echo "PASS: SQLite foreign-key integrity check is empty (no violations)"

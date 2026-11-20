# Offline service database snapshot and restore

The experimental `notebook.backup` command uses SQLite's online backup API to create a consistent **plaintext** copy of the web/Linux service database. It validates schema, basic SQLite consistency and foreign keys before and after copying. It publishes with exclusive destination creation so it **never silently overwrites** an existing file. Copies use owner-only file permissions on Linux. The output parent directory must already exist.

```sh
# From the repository, with the Python environment installed:
export PYTHONPATH=server
.venv/bin/python -m notebook.backup verify --source ~/.local/share/goreecloud/notebook/notes.sqlite3

# Write into an existing private destination directory, never into Git:
.venv/bin/python -m notebook.backup backup \
  --source ~/.local/share/goreecloud/notebook/notes.sqlite3 \
  --destination ~/private-backups/notebook-2026-11-20.sqlite3

# Restore to a NEW path only after a recovery decision, never over live data:
.venv/bin/python -m notebook.backup restore \
  --source ~/private-backups/notebook-2026-11-20.sqlite3 \
  --destination ~/restored-notebook.sqlite3
```

The command does **not** encrypt backups, schedule them, test actual drive failure, support Android's separate local schema, verify filesystem durability after power loss or prove production disaster recovery. Keep encrypted, access-controlled copies on a different trusted storage device and conduct a supervised restore rehearsal. Never check snapshot contents into the public repository. Do not rename/move the live SQLite database while the application is running.

The synthetic source test suite covers snapshot, restore, revision data, WAL-mode copying, owner-only permissions, corrupt input and no-overwrite behavior.

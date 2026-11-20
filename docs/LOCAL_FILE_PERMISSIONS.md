# Read-only local SQLite file/sidecar permission audit

**Scope:** GoreeCloud Notebook local service and native Linux data files. This is an opt-in file-metadata check, **not a malware scan, encryption mechanism, Wardveil integration, or a substitute for access controls**.

The service creates new private local SQLite files, but an existing file may predate that behavior or have been copied from external storage with broader permissions. A SQLite WAL, shared-memory or rollback-journal sidecar may contain recoverable fragments of note content. Audit the active database **without opening or querying its contents**:

```sh
PYTHONPATH=server .venv/bin/python -m notebook.permissions_audit
# Or specify the database path you own:
PYTHONPATH=server .venv/bin/python -m notebook.permissions_audit --database /path/to/notes.sqlite3
```

The command performs only `lstat` checks on the named database, its immediate parent directory, and `-wal`, `-shm` and `-journal` sidecar paths when present. It warns on symlinks, unexpected file types, ownership mismatches and group/world permissions. It returns exit code **2** for flagged entries; **0** when all inspected entries are private or the database is absent (in which case absence is reported explicitly). No note bodies, tokens or database bytes are read, and no modes, owners, directories or files are changed.

For a **single-user private installation**, the expected default is **0700** on the private Notebook data directory and **0600** on the SQLite files and sidecars. If the audit reports other permissions, inspect application service identity, ACLs, collaboration requirements and available backups **before choosing** an administrative remedy. Blind `chmod -R`, changing ownership while a service is running, automatic deletion and changes to unrelated directories are unsafe. A service intentionally shared through a group may require a documented separate policy and stronger isolation.

**Known limitations:** POSIX permission bits do not cover all filesystem ACLs, SELinux/AppArmor, encrypted filesystems, snapshot copies, cloud backups, permissions on all ancestors or a compromised user's session. The auditor cannot certify confidentiality. It also does not encrypt an active SQLite database, repair permissions, or provide GoreeCloud Identity user isolation.

Regression tests in `server/tests/test_permissions_audit.py` use synthetic temporary files and assert that the checker never modifies their data or permissions. Treat any actual device finding as an operator review item, not a publicly advertised vulnerability.

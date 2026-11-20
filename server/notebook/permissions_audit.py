"""Read-only GoreeCloud Notebook local SQLite filesystem permission audit.

Does not open SQLite or read notes, does not modify permissions or files.
Requires an intentional operator decision before changing live file access.
"""
from __future__ import annotations

import argparse
import os
import stat
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AuditReport:
    checked: tuple[str, ...]
    issues: tuple[str, ...]
    exists: bool


def default_database() -> Path:
    configured=os.environ.get("GC_NOTEBOOK_DB")
    if configured:
        return Path(configured).expanduser()
    root=Path(os.environ.get("XDG_DATA_HOME",str(Path.home()/".local/share")))
    return root/"goreecloud"/"notebook"/"notes.sqlite3"


def audit(path: str | Path) -> AuditReport:
    """Check only the named database, its containing directory and SQLite sidecars.

    No filesystem mutation, no follow-symlink lookups, and no SQLite queries.
    """
    target=Path(path).expanduser()
    candidates=(target,Path(str(target)+"-wal"),Path(str(target)+"-shm"),
                Path(str(target)+"-journal"))
    checked=[]
    issues=[]
    exists=False
    owner=os.getuid() if hasattr(os,"getuid") else None
    for name,item in [("Notebook directory",target.parent),
                      ("SQLite database",candidates[0]),
                      ("SQLite WAL",candidates[1]),
                      ("SQLite SHM",candidates[2]),
                      ("SQLite rollback journal",candidates[3])]:
        try:
            metadata=item.lstat()
        except FileNotFoundError:
            continue
        except OSError as exc:
            issues.append(f"{name}: cannot safely inspect metadata ({type(exc).__name__})")
            continue
        checked.append(name)
        if item==target:
            exists=True
        if stat.S_ISLNK(metadata.st_mode):
            issues.append(f"{name}: symlink present; inspect without following it")
            continue
        if item==target.parent:
            if not stat.S_ISDIR(metadata.st_mode):
                issues.append(f"{name}: expected a directory")
        elif not stat.S_ISREG(metadata.st_mode):
            issues.append(f"{name}: expected a regular file")
        if owner is not None and metadata.st_uid != owner:
            issues.append(f"{name}: owned by a different user")
        mode=stat.S_IMODE(metadata.st_mode)
        if mode & 0o077:
            issues.append(f"{name}: group/other permissions detected ({mode:04o})")
        if item==target.parent and mode & 0o700 != 0o700:
            issues.append(f"{name}: owner cannot fully access its directory ({mode:04o})")
    return AuditReport(tuple(checked),tuple(issues),exists)


def main(argv:list[str]|None=None)->int:
    parser=argparse.ArgumentParser(
        description="Read-only GoreeCloud Notebook database file and directory permission check")
    parser.add_argument("--database",type=Path,default=default_database(),
                        help="Local SQLite path; never read or change its content")
    args=parser.parse_args(argv)
    result=audit(args.database)
    if not result.exists:
        print("Notebook SQLite database absent at selected path. No note content read.")
    print(f"Checked {len(result.checked)} existing local filesystem entries; no file bytes read.")
    if result.issues:
        for issue in result.issues:
            print("ATTENTION:",issue)
        print("Review ownership, application service dependencies and data backups before manual remediation.")
        return 2
    print("PASS: No unsafe local file or directory permissions were detected among existing entries.")
    return 0


if __name__=="__main__":
    raise SystemExit(main())

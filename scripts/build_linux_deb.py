#!/usr/bin/env python3
"""Build an unsigned, self-contained Ubuntu/Linux x86_64 development .deb.

Requires trusted, pinned PySide6==6.12.0 installed in the Python environment.
Never runs package maintainer scripts or connects to the network.
"""
from __future__ import annotations

import argparse
import importlib.metadata
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.1.0~dev1"
PACKAGE = "goreecloud-notebook"
APP_ROOT = Path("opt/goreecloud/notebook")
CONTROL = """Package: goreecloud-notebook
Version: 0.1.0~dev1
Section: office
Priority: optional
Architecture: amd64
Maintainer: GoreeCloud <admin@goreecloud.com>
Depends: python3 (>= 3.12), libc6 (>= 2.38), libegl1, libxkbcommon0, libxkbcommon-x11-0, libdbus-1-3
Description: GoreeCloud Notebook native Qt Quick 6.12 development client
 Experimental offline-native personal knowledge notes on local SQLite.
 This is a development preview, not a signed production release.
"""
LAUNCH = """#!/bin/sh
set -eu
BASE="${GC_NOTEBOOK_PACKAGE_ROOT:-/opt/goreecloud/notebook}"
export PYTHONPATH="$BASE/vendor${PYTHONPATH:+:$PYTHONPATH}"
exec /usr/bin/python3 "$BASE/linux/main.py" "$@"
"""
DESKTOP = """[Desktop Entry]
Type=Application
Name=GoreeCloud Notebook
GenericName=Personal Knowledge Notebook
Comment=Offline native notes on this device
Exec=goreecloud-notebook
Terminal=false
Icon=accessories-text-editor
Categories=Office;Utility;
"""
IGNORE = shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo", "*.pyi", "*.pyi", "tests")


def validate():
    if sys.version_info[:2] != (3, 12) or platform.machine() != "x86_64":
        raise SystemExit("Building this package requires Linux x86_64 and Python 3.12")
    import PySide6
    import shiboken6
    if importlib.metadata.version("PySide6") != "6.12.0":
        raise SystemExit("Expected vetted PySide6==6.12.0")
    return Path(PySide6.__file__).parent, Path(shiboken6.__file__).parent


def write(path: Path, content: str, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    path.chmod(mode)


def build(output: Path):
    qtsrc, shibokensrc = validate()
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise SystemExit(f"Refusing to overwrite existing package: {output}")
    if not shutil.which("dpkg-deb"):
        raise SystemExit("dpkg-deb is required")
    with tempfile.TemporaryDirectory(prefix="goreecloud-notebook-deb-") as temp:
        staging = Path(temp) / "root"
        app = staging / APP_ROOT
        (app/"vendor").mkdir(parents=True)
        (app/"linux").mkdir(exist_ok=True)
        for filename in ("main.py", "recovery.py"):
            shutil.copy2(ROOT/"linux"/filename,app/"linux"/filename)
        shutil.copytree(ROOT/"linux/qml",app/"linux/qml",ignore=IGNORE)
        (app/"server/notebook").mkdir(parents=True)
        for name in ("store.py","transfer.py","__init__.py"):
            shutil.copy2(ROOT/"server/notebook"/name,app/"server/notebook"/name)
        shutil.copytree(qtsrc,app/"vendor/PySide6",ignore=IGNORE,symlinks=True)
        shutil.copytree(shibokensrc,app/"vendor/shiboken6",ignore=IGNORE,symlinks=True)
        # Dynamic Qt .so libraries remain replaceable in /opt for LGPL compliance.
        write(staging/"DEBIAN/control",CONTROL)
        write(staging/"usr/bin/goreecloud-notebook",LAUNCH,0o755)
        write(staging/"usr/share/applications/goreecloud-notebook.desktop",DESKTOP)
        write(staging/"usr/share/doc/goreecloud-notebook/LICENSE", (ROOT/"LICENSE").read_text())
        write(staging/"usr/share/doc/goreecloud-notebook/DEPENDENCIES.md",
              (ROOT/"docs/DEPENDENCIES.md").read_text())
        write(staging/"usr/share/doc/goreecloud-notebook/BUILD-METADATA",
              "Python 3.12 / PySide6 Qt 6.12.0 / x86_64 Linux\n"
              "Qt for Python: https://code.qt.io/cgit/pyside/pyside-setup.git/\n"
              "Qt upstream source: https://code.qt.io/cgit/qt/\n"
              "shiboken6 is provided by the PySide6 project.\n"
              "This package includes dynamically linked third-party binaries.\n"
              "No account secrets, note databases, or networking logic are bundled.\n")
        subprocess.run(
            ["dpkg-deb","--build","--root-owner-group","-Zzstd","-z1","--threads-max=2",
             str(staging),str(output)],
            check=True
        )
    print(f"Built unsigned development Debian package: {output}")
    print(f"Size: {output.stat().st_size} bytes")
    return output


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",default=str(ROOT/"dist/linux"/"goreecloud-notebook_0.1.0~dev1_amd64.deb"))
    args=parser.parse_args()
    build(Path(args.output).expanduser().absolute())

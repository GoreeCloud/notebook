# Native Qt Quick 6.12 Linux development Debian package

The repository now contains an **unsigned local .deb builder**, `scripts/build_linux_deb.py`, which bundles the existing GPL/LGPL/commercial-licensed PySide6 6.12.0 Qt runtime as separate, dynamically linked files. It includes the GoreeCloud Notebook native Linux client, local SQLite store module, desktop entry and launcher. There are no pre/post-install scripts, account secrets, network calls or live SQLite databases in the package.

Build on a trusted **x86_64 Ubuntu 24.04-compatible Linux** environment with Python 3.12, `dpkg-deb` and verified `PySide6==6.12.0` already installed in the invoked Python environment:

```sh
# From repository root, with the existing development environment ready:
.venv/bin/python scripts/build_linux_deb.py
bash scripts/smoke_linux_deb.sh dist/linux/goreecloud-notebook_0.1.0~dev1_amd64.deb
```

The GitHub Qt smoke CI job also builds and extracts this candidate but intentionally does **not** upload public binary artifacts pending a full upstream license/redistribution review.

The smoke script extracts the package into a temporary private directory, executes its bundled Qt client with an isolated synthetic SQLite database, and removes the temporary data afterward. It **does not install the package** on the computer or prove installation, user desktop integration, filesystem persistence, upgrades or distribution compatibility on a separate Linux machine.

**Runtime limitations:** The package targets x86_64, Python 3.12, glibc 2.38+, Qt 6.12.0, libEGL and libxkbcommon system dependencies. It is not currently portable to all distros, architectures, Python versions or hardened sandbox policies. Native code and dynamic shared libraries remain editable/relinkable under `/opt/goreecloud/notebook/vendor/`.

**License/distribution gate:** PySide6, shiboken6 and Qt contain upstream third-party code with LGPL/GPL/commercial license conditions. The builder preserves package files, bundles original-source/license provenance references and the first-party MIT license. Before publishing binary downloads, a maintainer must independently audit all Qt plugin/modules, notices, license text delivery, corresponding-source obligations, and any other binary redistribution requirements. **No distributable public release or SBOM is certified.** See `docs/DEPENDENCIES.md` for the upstream sources.

Generated `dist/linux/*.deb` files are intentionally excluded from Git. Never add private note databases, bearer tokens, Linux secrets or third-party font files into a package.

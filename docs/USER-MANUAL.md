# GoreeCloud Notebook — Development User Guide

**This is not yet an installation-ready GoreeCloud release.** Do not replace a working note installation or point the derived Development build at your only notebook database.

## Current inherited workflow

The source base includes a hierarchical note tree, rich editing, attributes, search, imports, exports, protected notes, self-hosted sync and a browser clipper. For upstream behavior and current compatibility, consult the [TriliumNext documentation](https://docs.triliumnotes.org/) and validate against the exact upstream version before using anything critical.

## Importing from Evernote (pending GoreeCloud qualification)

1. Export notes from Evernote in ENEX format and retain the originals securely.
2. Back up the destination database using the upstream-supported procedure.
3. Perform first imports on a disposable test notebook, not the only copy of personal data.
4. Inspect notes, images, PDFs, timestamps, tags, links and any reported skipped items.
5. Do not discard ENEX files until restoring the destination and the imported content have been verified.

The Development import dialog now performs a **limited, local ENEX header check** and requires a backup acknowledgment before uploading. It does not read every note, guarantee a complete import, validate every attachment, or replace a real backup-and-restore test. The dialog also rejects repeated file entries within one selection. It compares local file identity and browser metadata, not the exported note contents; two different exports may need different filenames if their metadata matches. Full note-by-note previews, deduplication against imported notes, and migration qualification remain pending.

## Privacy and accessibility

Prefer self-hosted environments you control. Treat sync, shared links, clipper content and automated scripts as security-sensitive. Reduce motion/transparency using system accessibility preferences when supported; the GoreeCloud consumer-level Glaze acceptance work remains open.

## Upgrading

No cross-release GoreeCloud Notebook upgrade policy has been qualified yet. Preserve a restorable backup, verify matching sync and schema versions, and test upgrades on a copy before real-world use.

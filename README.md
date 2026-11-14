# GoreeCloud Notebook

**Status: early source development; not released or deployed.**

This default branch is the minimal repository baseline. The [local-first Notebook PWA development implementation](https://github.com/GoreeCloud/notebook/pull/1) remains in **draft PR #1** and is **not merged into `main`**. Passing draft-branch tests do not validate a released Notebook application.

Notebook is a distinct product from [GoreeCloud Memos](https://github.com/GoreeCloud/memos), [GoreeCloud Noteflow](https://github.com/GoreeCloud/noteflow), and [GoreeCloud Notes](https://github.com/GoreeCloud/notes). Its planned direction is private, user-controlled knowledge and note organization. Requirements and feature status are tracked in the authorized GoreeCloud Drive project folder; implemented features in the draft must not be described as available from `main`.

## Before promoting the draft

- Review data integrity, offline/backup recovery and cross-tab conflicts with disposable data.
- Migrate browser-accessible UI to a founder-approved principal web framework and verify GoreeCloud UI conformance.
- Validate privacy, accessibility, supported browsers, licensing/provenance and clean installation.
- Require tested release and deployment gates; do not treat source or green CI alone as production acceptance.

## License

This repository has its own [MIT license](LICENSE). Separate third-party and GoreeCloud UI license notices in the draft must be retained if those components are merged.

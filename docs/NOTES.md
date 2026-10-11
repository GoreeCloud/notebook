# Engineering notes

- On 2026-10-10, authenticated GitHub identity **GoreeCloud** and the preexisting `GoreeCloud/notebook` repository were verified before importing source.
- Target initial main commit: `9fe30d920747ce30ae35c8464e4575b4d8ecaa35`. Source upstream head: `6246ce308109e90fe2e86fe8883d129e5f3e35a5`.
- The upstream repository full-history merge is retained only in the isolated local integration candidate. The published staging approach is a single-source-snapshot commit on the original GoreeCloud main ancestry; the remote does not carry upstream Git history. No force-push or repository deletion is authorized.
- Runtime/build testing, Evernote migration fidelity, backup/restore and Glaze consumer acceptance have **not** been established.
- Inherited GitHub Actions workflows include release/deploy jobs; they are disabled in the derived tree until an independent GoreeCloud audit authorizes replacement workflows.
- Source-only tests intentionally do not claim product qualification.

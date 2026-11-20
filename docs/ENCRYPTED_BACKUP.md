# Encrypted offline SQLite snapshots — development preview

The optional `server/notebook/encrypted_backup.py` CLI creates an **authenticated encrypted backup** of the local Notebook service SQLite database and restores it only after verifying the archive's authentication tag and SQLite integrity. This is an **opt-in local backup format**, not application-wide at-rest encryption, GoreeCloud Identity integration, E2EE synchronization, device key management, or a production security certification.

## Supported environment and dependencies

Python 3.12+ on an authorized local Linux/macOS/Windows developer machine with optional `cryptography==50.0.2` (PyCA, Apache-2.0/BSD dual license). Install its pinned requirements:

```sh
.venv/bin/python -m pip install -r server/requirements-crypto.txt
```

Open-source upstream: [PyCA cryptography](https://github.com/pyca/cryptography), [official AESGCM API](https://cryptography.io/en/stable/hazmat/primitives/aead/), and [Argon2id KDF](https://cryptography.io/en/stable/hazmat/primitives/key-derivation-functions/#argon2id).

## Interactive operation

From repository root (replace paths with **your own private, existing directories**):

```sh
PYTHONPATH=server .venv/bin/python -m notebook.encrypted_backup backup \
  --source ~/.local/share/goreecloud/notebook/notes.sqlite3 \
  --destination ~/private-recovery/notebook.gcnb

PYTHONPATH=server .venv/bin/python -m notebook.encrypted_backup restore \
  --source ~/private-recovery/notebook.gcnb \
  --destination ~/private-recovery/restored-notes.sqlite3
```

The CLI prompts without echo for a **new backup passphrase at least 16 UTF-8 bytes long** (with confirmation during backup). Do not use your account password, put a passphrase on the command line, commit it, or send it to logs/chat. The passphrase is **not recoverable** if forgotten. Keep independent, physically separate backups and periodically rehearse a restore on a different device.

## Format and controls

- Binary `GCNB-ENCRYPTED-V1` envelope: fixed magic, randomly generated 16-byte salt, 12-byte nonce, and ciphertext authenticated with AES-256-GCM.
- Key derivation: Argon2id with **64 MiB memory, 3 iterations, 4 lanes**, deriving a 32-byte key from the passphrase. Version 1 parameters are fixed; any changed cost/algorithm requires a new format version and a migration plan.
- The source database is captured into a **consistent SQLite in-memory snapshot** (including changes in WAL mode); the serialized image's WAL journal-mode header is normalized to rollback-journal mode, and the resulting image is revalidated before encryption. **No new plaintext backup work file is created during encryption.**
- Decryption verifies the GCM authentication tag and validates SQLite `quick_check`, foreign-key references and the expected Notebook tables **before** writing a restored plaintext database.
- New backup and restore files use owner-only **0600** permissions and atomic publication that refuses to overwrite or follow an existing destination. Existing-file and symlinked-source paths are rejected.
- A **128 MiB uncompressed SQLite size cap** limits memory use and disallows silently incomplete backups; large stores require a different reviewed streaming format. The implementation uses Python memory for plaintext during processing and cannot guarantee in-process memory zeroization.
- Restoring writes an **unencrypted SQLite file** at the explicitly chosen destination. Protect or remove that plaintext file according to GoreeShield policies and device safeguards.

## Limitations and security gates

This archive format has not been externally reviewed. It deliberately uses standard upstream audited crypto primitives, but protocol composition, passphrase usability, tamper resistance, recovery from corrupted originals, memory exposure, host compromise, backup media theft and interoperability still need independent professional review. No automatic scheduled backups, off-device replication, escrow, secure deletion guarantee, secret manager, encrypted live SQLite or cloud drive uploader is implemented.

The service remains SQLite plaintext. A local attacker with access to the original note database may read unencrypted content regardless of the encrypted backup. The existing JSON/Markdown export endpoints still produce plaintext content.

Tests in `server/tests/test_encrypted_backup.py` cover WAL snapshot preservation, note revisions, authenticated restore, wrong passphrases, tampering, truncated input, path collisions, permissions and refusal of symlinked sources. The CI job installs optional crypto dependencies to run these tests; this dependency is not required for ordinary web, Linux or Android application startup.

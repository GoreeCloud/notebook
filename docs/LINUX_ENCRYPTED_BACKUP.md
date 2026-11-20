# Native Linux opt-in encrypted backup — development preview

The Qt Quick Linux sidebar now offers a **manually confirmed, local-only
encrypted SQLite backup** when optional, pinned PyCA cryptography is available.
It uses the existing first-party notebook.encrypted_backup implementation,
not a new crypto protocol. The user chooses a NEW private destination with a
native file picker and enters/matches a passphrase of at least 16 characters.

The live SQLite stays **plaintext**. The .gcnb output encrypts the complete
SQLite snapshot including Trash and revisions with Argon2id/AES-256-GCM and
verifies the captured database before encryption. No intermediate plaintext
backup file is created. Output is mode 0600 with an atomic no-overwrite policy.
Remote file URLs, invalid or existing destinations, and weak passphrases are
refused.

Password text fields mask and clear on cancellation or after file selection,
but QML and Python can hold transient secret copies; **secure memory erasure
is not guaranteed**. The passphrase is not recoverable. No encrypted restore
is performed into live SQLite from the Qt UI: use the separate, explicit
restore CLI with a new destination described in
[Encrypted Offline Backup](ENCRYPTED_BACKUP.md).

The experimental unsigned Debian package includes first-party snapshot
modules but does NOT bundle compiled optional PyCA crypto wheels. Its control
is disabled when cryptography is unavailable. A source-based Python virtual
environment may install the pinned optional crypto requirements. No signed
production release, unattended cloud backup or GoreeShield enforcement
is claimed.

Synthetic bridge tests confirm encrypted exports, private mode, no plaintext
canary exposure, no-overwrite/refusal and independent SQLite restoration of
notes and revisions. Headless Qt and unsigned package smoke cannot establish
actual file-picker, assistive-technology, off-device recovery or external
security-review acceptance.

**CI-specific dependency:** The Qt job installs the same pinned optional PyCA
requirements used by the backend crypto tests, so the native encrypted-export
bridge is exercised. This test installation is independent of package contents:
the extracted unsigned Debian package continues to use the system runtime and
does not contain compiled cryptography wheels.

**Archive validation without plaintext output:** Developers may run the
local encrypted-backup CLI verify action with a source path. This
authenticates and checks an in-memory SQLite image, without replacing
the Qt application's live store or writing a plaintext restore file.
This does not replace independent recovery drills.

## Native verify-only encrypted archive flow

Qt Quick now exposes a separate "Verify encrypted backup (no restore)"
control when optional cryptography is available. Choose an **existing**
local encrypted archive in the native open-file dialog, enter its
passphrase in a password-masked field and confirm. The native bridge
calls the same bounded V1 archive authentication and SQLite in-memory
integrity check used by the command-line verify action; it reports
only notebook/note counts and never writes a plaintext file or replaces
live data. Invalid archives, remote paths, wrong passphrases or tampering
are refused. Canceling or completing the dialog clears its password field.

The archive and passphrase still reside temporarily in process memory,
and GUI passphrase fields do not guarantee secure RAM zeroization.
The native dialog has source-level and headless synthetic tests,
but awaits manual file-picker, accessibility, failure recovery and
independent off-device restore rehearsal acceptance.

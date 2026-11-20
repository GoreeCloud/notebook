# GoreeCloud Notebook security

This is an experimental development preview. Do not store highly sensitive data without assessing backups, encryption, access control and device security first.

Report vulnerabilities privately using the GitHub repository's security advisory/private vulnerability reporting route when available. Never publish bearer tokens, private notebook content or exploitation details in a public issue.

Known limits: one shared bearer token (no accounts or Identity integration); SQLite not encrypted at application level; no tested restore path; no per-user permissions, rate limits, remote TLS, sync security proof, mobile hardware acceptance or production audit. The API must remain on loopback by default. Use a verified TLS/auth gateway and audited per-user authorization before remote exposure. Android's `allowBackup=false` prevents unintended cloud backup but also means data recovery is not implemented.

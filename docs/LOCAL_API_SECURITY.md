# Local API boundary — development-only security

GoreeCloud Notebook remains a self-hosted, local-development service, **not** a production multi-user application. This change restricts accidental exposure without claiming GoreeCloud Identity, GoreeShield or Wardveil integration.

Implemented controls:

- The HTTP API still requires a high-entropy bearer token of 24+ characters on every `/api/v1/*` request. Use the environment, never source control or query parameters, to supply this token.
- POST/PATCH/PUT/DELETE requests are capped at **12 MiB** including streamed/chunked requests. The request body is buffered up to this bound before JSON parsing, returning HTTP 413 when oversized. Archives additionally enforce their own stricter format-specific limits.
- API responses add `Cache-Control: no-store`, `Pragma: no-cache`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a restrictive API-only CSP. The React app is served separately; this CSP does not replace a browser-app CSP.
- `GC_NOTEBOOK_ORIGINS` rejects wildcard and invalid origins. Non-loopback browser origins require explicit `GC_NOTEBOOK_ALLOW_REMOTE_ORIGINS=1`; enabling them **does not** make remote deployment secure or supported.
- Newly created SQLite database files use owner-only `0600` permissions; newly created containing directories use `0700`. Existing file and folder permissions are not changed. Direct symlink database paths are refused.

The server's documented launch command must still bind to **127.0.0.1**. The origin validator is not a firewall; it cannot prevent inbound requests made directly by other processes, malicious local users, or exposure through a reverse proxy. No rate limiting, user authorization, Identity sessions, application-layer encryption, production TLS, external network audit, authenticated Mesh device pairing or comprehensive threat defense is implemented. Do not use untrusted public ingress.

Run `PYTHONPATH=server .venv/bin/pytest -q server/tests/test_http_boundary.py` for stream-size, CORS, secrets, no-cache header and file-mode checks.

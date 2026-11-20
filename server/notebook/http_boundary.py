"""Small ASGI API boundary for sensitive local notebook data.

Limits streamed request bodies and applies no-cache/anti-sniffing headers.
This does not replace Identity, Wardveil, HTTPS, or network access policy.
"""
from __future__ import annotations

from typing import Any, Awaitable, Callable

MAX_REQUEST_BYTES = 12 * 1024 * 1024


class LimitExceeded(Exception):
    pass


class LocalApiBoundary:
    def __init__(self, app: Callable):
        self.app = app

    async def __call__(self, scope: dict, receive: Callable, send: Callable):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = dict(scope.get("headers", []))
        uri = scope.get("path", "")
        protected = uri.startswith("/api/v1")
        response_headers = [
            (b"x-content-type-options", b"nosniff"),
            (b"referrer-policy", b"no-referrer"),
            (b"x-frame-options", b"DENY"),
            (b"content-security-policy", b"default-src 'none'"),
        ]
        if protected:
            response_headers.append((b"cache-control", b"no-store"))
            response_headers.append((b"pragma", b"no-cache"))

        async def secured_send(message: dict):
            if message["type"] == "http.response.start":
                existing = {k.lower() for k, _ in message.get("headers", [])}
                message = dict(message)
                message["headers"] = list(message.get("headers", [])) + [
                    (k, v) for k, v in response_headers if k not in existing
                ]
            await send(message)

        async def reject():
            payload = b'{"detail":"Request body exceeds 12 MiB limit"}'
            await secured_send({
                "type": "http.response.start", "status": 413,
                "headers": [(b"content-type", b"application/json")]
            })
            await send({"type": "http.response.body", "body": payload})

        if scope.get("method") in ("POST", "PATCH", "PUT", "DELETE"):
            length = headers.get(b"content-length")
            if length is not None:
                try:
                    amount = int(length)
                    if amount < 0:
                        raise ValueError()
                except ValueError:
                    await secured_send({
                        "type": "http.response.start", "status": 400,
                        "headers": [(b"content-type", b"application/json")]
                    })
                    await send({
                        "type": "http.response.body",
                        "body": b'{"detail":"Invalid Content-Length"}'
                    })
                    return
                if amount > MAX_REQUEST_BYTES:
                    await reject()
                    return

            # Read only up to the declared cap before invoking FastAPI. JSON
            # parsing can otherwise swallow a streaming limit exception and
            # turn an oversized request into an ambiguous HTTP 400.
            chunks = []
            seen = 0
            while True:
                event = await receive()
                if event["type"] == "http.disconnect":
                    return
                if event["type"] != "http.request":
                    return
                part = event.get("body", b"")
                seen += len(part)
                if seen > MAX_REQUEST_BYTES:
                    await reject()
                    return
                chunks.append(part)
                if not event.get("more_body", False):
                    break
            body = b"".join(chunks)
            replayed = False

            async def replay_receive():
                nonlocal replayed
                if not replayed:
                    replayed = True
                    return {"type": "http.request", "body": body, "more_body": False}
                return await receive()

            await self.app(scope, replay_receive, secured_send)
            return

        await self.app(scope, receive, secured_send)

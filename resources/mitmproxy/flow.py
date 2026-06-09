# MobSec Studio mitmproxy addon.
#
# Streams every HTTP/HTTPS flow as JSON lines on stdout so the MobSec Studio
# main process can ingest them. Each flow produces up to two events:
#   { "event": "request",  ... } when the request is dispatched
#   { "event": "response", ... } when the response arrives
#
# We use stdout because mitmdump --scripts spawns this in-process; stdout
# is shared with the parent. Each line is a single newline-terminated JSON
# object (NDJSON). Bodies are base64-encoded so binary content survives.

import base64
import json
import sys

from mitmproxy import http


_MAX_BODY_BYTES = 1024 * 1024  # 1 MiB per body; bigger ones are truncated.


def _emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def _encode_body(raw: bytes | None) -> dict:
    if raw is None:
        return {"body": None, "bodySize": 0, "bodyTruncated": False}
    truncated = len(raw) > _MAX_BODY_BYTES
    chunk = raw[:_MAX_BODY_BYTES] if truncated else raw
    return {
        "body": base64.b64encode(chunk).decode("ascii"),
        "bodySize": len(raw),
        "bodyTruncated": truncated,
    }


def request(flow: http.HTTPFlow) -> None:
    req = flow.request
    payload = {
        "event": "request",
        "id": flow.id,
        "timestamp": req.timestamp_start,
        "method": req.method,
        "scheme": req.scheme,
        "host": req.host,
        "port": req.port,
        "path": req.path,
        "url": req.url,
        "headers": [(k, v) for k, v in req.headers.items(multi=True)],
        "httpVersion": req.http_version,
        **_encode_body(req.raw_content),
    }
    _emit(payload)


def response(flow: http.HTTPFlow) -> None:
    if flow.response is None:
        return
    resp = flow.response
    duration_ms = None
    if resp.timestamp_end is not None and flow.request.timestamp_start is not None:
        duration_ms = int((resp.timestamp_end - flow.request.timestamp_start) * 1000)
    payload = {
        "event": "response",
        "id": flow.id,
        "status": resp.status_code,
        "statusText": resp.reason or "",
        "headers": [(k, v) for k, v in resp.headers.items(multi=True)],
        "httpVersion": resp.http_version,
        "contentType": resp.headers.get("content-type"),
        "durationMs": duration_ms,
        **_encode_body(resp.raw_content),
    }
    _emit(payload)


def error(flow: http.HTTPFlow) -> None:
    """A flow that errored out (DNS, connection refused, TLS handshake fail…)."""
    if flow.error is None:
        return
    _emit(
        {
            "event": "error",
            "id": flow.id,
            "message": str(flow.error),
        }
    )

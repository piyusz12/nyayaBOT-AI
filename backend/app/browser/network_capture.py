"""Network traffic instrumentation for recording merchant dispute interactions."""

from __future__ import annotations

import time
from typing import Any, Dict, List


class NetworkCapture:
    """Records network transactions, headers, and cancellation telemetry."""

    def __init__(self):
        self.records: List[Dict[str, Any]] = []

    def record_request(
        self,
        method: str,
        url: str,
        status_code: int,
        latency_ms: float,
        request_headers: Dict[str, str] | None = None,
        response_summary: str | None = None,
    ) -> Dict[str, Any]:
        """Record an observed HTTP interaction with sanitized headers."""
        safe_headers = {}
        if request_headers:
            for k, v in request_headers.items():
                if k.lower() not in {"authorization", "cookie", "set-cookie", "x-api-key"}:
                    safe_headers[k] = v

        entry = {
            "timestamp": time.time(),
            "method": method.upper(),
            "url": url,
            "status_code": status_code,
            "latency_ms": round(latency_ms, 2),
            "headers": safe_headers,
            "summary": response_summary,
        }
        self.records.append(entry)
        return entry

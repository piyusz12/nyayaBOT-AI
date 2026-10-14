"""Browser evidence capture module for saving dispute screenshots and DOM states."""

from __future__ import annotations

import io
import time
from typing import Dict, Tuple
from app.storage.evidence_storage import storage


class EvidenceCapture:
    """Captures and registers verifiable browser evidence artifacts."""

    @staticmethod
    def capture_html_snapshot(
        case_id: str,
        page_title: str,
        dom_content: str,
        url: str,
    ) -> Tuple[str, str, int]:
        """Save a captured DOM snapshot as verifiable evidence.

        Returns:
            Tuple of (storage_key, sha256_digest, byte_count)
        """
        header = f"<!-- SOURCE URL: {url} | CAPTURED_AT: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())} -->\n"
        full_content = (header + dom_content).encode("utf-8")
        stream = io.BytesIO(full_content)
        filename = f"snapshot_{page_title.replace(' ', '_')[:32]}.html"

        storage_key, sha256, size = storage.save_file(stream, filename, case_id)
        return storage_key, sha256, size

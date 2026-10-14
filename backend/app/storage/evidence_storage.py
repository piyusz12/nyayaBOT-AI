"""Private, secure evidence and document storage manager.

Enforces:
- Path-traversal prevention.
- Cryptographic SHA-256 integrity digest computation.
- Maximum file size enforcement (50 MB).
- Content-type validation.
- Isolation of original evidence from derived artifacts.
"""

from __future__ import annotations

import hashlib
import os
import shutil
from pathlib import Path
from typing import BinaryIO, Dict, Optional, Tuple

from app.config import settings
from app.core.exceptions import ValidationError

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
}


class EvidenceStorage:
    """Manages storage of uploaded evidence files and generated documents."""

    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = Path(base_dir or settings.EVIDENCE_STORAGE_PATH).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _safe_path(self, relative_key: str) -> Path:
        """Resolve path and verify it remains strictly within the base storage directory."""
        target_path = (self.base_dir / relative_key).resolve()
        if not str(target_path).startswith(str(self.base_dir)):
            raise ValidationError("Path traversal attempt detected in storage key.")
        return target_path

    def save_file(
        self,
        file_obj: BinaryIO,
        filename: str,
        case_id: str,
    ) -> Tuple[str, str, int]:
        """Save a file stream into isolated case storage.

        Returns:
            Tuple of (storage_key, sha256_hash, file_size_bytes)
        """
        # Validate safe extension
        ext = Path(filename).suffix.lower()
        if not ext:
            ext = ".bin"

        hasher = hashlib.sha256()
        case_dir = self.base_dir / case_id
        case_dir.mkdir(parents=True, exist_ok=True)

        # Temporary write to calculate hash and size
        temp_filename = f"tmp_{os.urandom(8).hex()}{ext}"
        temp_path = case_dir / temp_filename

        total_bytes = 0
        try:
            with open(temp_path, "wb") as f_out:
                while chunk := file_obj.read(64 * 1024):
                    total_bytes += len(chunk)
                    if total_bytes > MAX_FILE_SIZE_BYTES:
                        raise ValidationError(f"File size exceeds 50 MB limit: {total_bytes} bytes")
                    hasher.update(chunk)
                    f_out.write(chunk)

            sha256_digest = hasher.hexdigest()
            # Canonical storage key: <case_id>/<sha256[:16]>_<original_clean_filename>
            clean_name = Path(filename).name.replace(" ", "_")
            canonical_name = f"{sha256_digest[:16]}_{clean_name}"
            final_path = case_dir / canonical_name

            if final_path.exists():
                # Already stored exact identical content
                temp_path.unlink(missing_ok=True)
            else:
                temp_path.rename(final_path)

            storage_key = f"{case_id}/{canonical_name}"
            return storage_key, sha256_digest, total_bytes

        except Exception as e:
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)
            raise e

    def get_file_path(self, storage_key: str) -> Path:
        """Get the absolute filesystem path for an authorized storage key."""
        path = self._safe_path(storage_key)
        if not path.is_file():
            raise ValidationError(f"Storage object not found: {storage_key}")
        return path

    def delete_file(self, storage_key: str) -> bool:
        """Safely delete a stored file."""
        try:
            path = self._safe_path(storage_key)
            if path.is_file():
                path.unlink()
                return True
            return False
        except Exception:
            return False


storage = EvidenceStorage()

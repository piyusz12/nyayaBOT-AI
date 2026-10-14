from __future__ import annotations

import hashlib
from typing import Any, Dict
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.models import Evidence
from app.services.evidence_service import _extract_text_from_image, _extract_text_from_pdf
from app.storage.evidence_storage import storage


def process_evidence_task(evidence_id: str, db: Session) -> Dict[str, Any]:
    """Execute background processing, verification, and OCR parsing for an evidence item."""
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        logger.warning("Evidence item %s not found for processing", evidence_id)
        return {"status": "FAILED", "reason": "Evidence not found"}

    try:
        # Resolve physical file path and verify existence
        file_path = storage.get_file_path(evidence.storage_key)
        if not file_path.exists() or not file_path.is_file():
            evidence.validation_status = "invalid"
            db.commit()
            db.refresh(evidence)
            return {"status": "FAILED", "evidence_id": evidence_id, "reason": "File missing on disk"}

        # Verify cryptographic integrity (SHA-256)
        content = file_path.read_bytes()
        actual_sha256 = hashlib.sha256(content).hexdigest()

        if actual_sha256.lower() != (evidence.sha256 or "").lower():
            evidence.validation_status = "invalid"
            db.commit()
            db.refresh(evidence)
            logger.warning("Integrity check failed for evidence %s: hash mismatch", evidence_id)
            return {"status": "FAILED", "evidence_id": evidence_id, "reason": "Integrity checksum mismatch"}

        # Preserve duplicate status if previously identified, else set to valid
        if evidence.validation_status != "duplicate":
            evidence.validation_status = "valid"

        # Attempt OCR extraction if not already extracted
        if not evidence.ocr_extracted_text:
            ct = evidence.content_type or ""
            extracted_text = None
            if ct.startswith("image/"):
                extracted_text = _extract_text_from_image(file_path)
            elif ct == "application/pdf":
                extracted_text = _extract_text_from_pdf(file_path)

            if extracted_text:
                evidence.ocr_extracted_text = extracted_text

        db.commit()
        db.refresh(evidence)
        logger.info("Evidence %s processed successfully (status=%s)", evidence_id, evidence.validation_status)
        return {"status": "COMPLETED", "evidence_id": evidence_id, "validation_status": evidence.validation_status}

    except Exception as exc:
        db.rollback()
        logger.error("Evidence processing failed for %s: %s", evidence_id, exc)
        return {"status": "FAILED", "evidence_id": evidence_id, "error": str(exc)}

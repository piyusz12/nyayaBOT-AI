"""Evidence service — file storage, hashing, and OCR extraction."""

from __future__ import annotations

import hashlib
import os
import uuid
from pathlib import Path
from typing import Optional
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Evidence


def _compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


async def store_evidence(
    db: Session,
    *,
    case_id: str,
    file_data: bytes,
    original_filename: str,
    content_type: str,
) -> Evidence:
    """Store an evidence file and create the DB record."""
    sha256 = _compute_sha256(file_data)

    # Check for duplicate
    existing = (
        db.query(Evidence)
        .filter(Evidence.case_id == case_id, Evidence.sha256 == sha256)
        .first()
    )
    if existing:
        existing.validation_status = "duplicate"
        db.flush()
        return existing

    # Store file
    file_ext = Path(original_filename).suffix
    storage_key = f"{case_id}/{uuid.uuid4().hex}{file_ext}"
    full_path = Path(settings.EVIDENCE_STORAGE_PATH) / storage_key
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(file_data)

    # OCR extraction
    ocr_text = None
    if content_type and content_type.startswith("image/"):
        ocr_text = _extract_text_from_image(full_path)
    elif content_type == "application/pdf":
        ocr_text = _extract_text_from_pdf(full_path)

    evidence = Evidence(
        case_id=case_id,
        storage_key=storage_key,
        sha256=sha256,
        original_filename=original_filename,
        content_type=content_type,
        file_size_bytes=len(file_data),
        validation_status="valid",
        ocr_extracted_text=ocr_text,
    )
    db.add(evidence)
    db.flush()
    return evidence


def save_evidence(db: Session, case_id: str, upload_file: UploadFile) -> Evidence:
    """Synchronous wrapper for storing evidence from FastAPI UploadFile."""
    content = upload_file.file.read()
    sha256 = _compute_sha256(content)

    existing = (
        db.query(Evidence)
        .filter(Evidence.case_id == case_id, Evidence.sha256 == sha256)
        .first()
    )
    if existing:
        existing.validation_status = "duplicate"
        db.flush()
        return existing

    file_ext = Path(upload_file.filename or "evidence.bin").suffix
    storage_key = f"{case_id}/{uuid.uuid4().hex}{file_ext}"
    full_path = Path(settings.EVIDENCE_STORAGE_PATH) / storage_key
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(content)

    ocr_text = None
    ct = upload_file.content_type or "application/octet-stream"
    if ct.startswith("image/"):
        ocr_text = _extract_text_from_image(full_path)
    elif ct == "application/pdf":
        ocr_text = _extract_text_from_pdf(full_path)

    evidence = Evidence(
        case_id=case_id,
        storage_key=storage_key,
        sha256=sha256,
        original_filename=upload_file.filename,
        content_type=ct,
        file_size_bytes=len(content),
        validation_status="valid",
        ocr_extracted_text=ocr_text,
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return evidence


def get_evidence_by_id(db: Session, evidence_id: str) -> Optional[Evidence]:
    return db.query(Evidence).filter(Evidence.id == evidence_id).first()


def list_evidence_for_case(db: Session, case_id: str) -> list[Evidence]:
    return get_evidence_list(db, case_id)


def get_evidence_list(db: Session, case_id: str) -> list[Evidence]:
    return (
        db.query(Evidence)
        .filter(Evidence.case_id == case_id)
        .order_by(Evidence.created_at.desc())
        .all()
    )


def get_evidence_path(storage_key: str) -> Path:
    return Path(settings.EVIDENCE_STORAGE_PATH) / storage_key


def _extract_text_from_image(path: Path) -> str | None:
    """Attempt OCR on an image file using Tesseract."""
    try:
        import pytesseract
        from PIL import Image

        if settings.TESSERACT_CMD:
            pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
        img = Image.open(path)
        text = pytesseract.image_to_string(img)
        return text.strip() if text.strip() else None
    except Exception:
        return None


def _extract_text_from_pdf(path: Path) -> str | None:
    """Extract text from a PDF."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(str(path))
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        full_text = "\n".join(text_parts).strip()
        return full_text if full_text else None
    except Exception:
        return None

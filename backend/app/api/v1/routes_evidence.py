"""Evidence upload, retrieval, and download routes."""

from __future__ import annotations

import os
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Case, Evidence, User
from app.services.evidence_service import save_evidence
from app.storage.evidence_storage import storage

router = APIRouter(prefix="/evidence", tags=["v1-evidence"])


@router.post("", status_code=status.HTTP_201_CREATED)
def upload_evidence_endpoint(
    case_id: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Securely upload and register evidence for an authorized case."""
    case = db.query(Case).filter(Case.id == case_id, Case.user_id == user.id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Dispute case not found or unauthorized")

    try:
        ev = save_evidence(db, case_id=case.id, upload_file=file)
        return {
            "id": ev.id,
            "case_id": ev.case_id,
            "original_filename": ev.original_filename,
            "content_type": ev.content_type,
            "file_size_bytes": ev.file_size_bytes,
            "sha256": ev.sha256,
            "validation_status": ev.validation_status,
            "ocr_extracted_text": ev.ocr_extracted_text,
            "created_at": ev.created_at.isoformat(),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{evidence_id}")
def get_evidence_endpoint(
    evidence_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve metadata and OCR text for an evidence item."""
    ev = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence item not found")

    case = db.query(Case).filter(Case.id == ev.case_id, Case.user_id == user.id).first()
    if not case:
        raise HTTPException(status_code=403, detail="Unauthorized access to evidence item")

    return {
        "id": ev.id,
        "case_id": ev.case_id,
        "original_filename": ev.original_filename,
        "content_type": ev.content_type,
        "file_size_bytes": ev.file_size_bytes,
        "sha256": ev.sha256,
        "validation_status": ev.validation_status,
        "ocr_extracted_text": ev.ocr_extracted_text,
        "created_at": ev.created_at.isoformat(),
    }


@router.get("/{evidence_id}/download")
def download_evidence_endpoint(
    evidence_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream authorized evidence file to authenticated client."""
    ev = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence item not found")

    case = db.query(Case).filter(Case.id == ev.case_id, Case.user_id == user.id).first()
    if not case:
        raise HTTPException(status_code=403, detail="Unauthorized access to evidence download")

    try:
        path = storage.get_file_path(ev.storage_key)
        return FileResponse(
            path=str(path),
            filename=ev.original_filename or "evidence.bin",
            media_type=ev.content_type or "application/octet-stream",
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"File not available on disk: {exc}")

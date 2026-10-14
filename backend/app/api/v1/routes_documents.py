"""Legal document generation and download endpoints."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Case, Evidence, User
from app.services.document_service import generate_document
from app.storage.evidence_storage import storage

router = APIRouter(prefix="/documents", tags=["v1-documents"])


class DocumentGeneratePayload(BaseModel):
    case_id: str
    document_type: str = "grievance_notice"
    custom_notes: Optional[str] = None


@router.post("/generate")
def generate_document_endpoint(
    payload: DocumentGeneratePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate, compile, and record a formal legal document artifact."""
    case = db.query(Case).filter(Case.id == payload.case_id, Case.user_id == user.id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or unauthorized")

    doc = generate_document(
        db=db,
        case_id=case.id,
        document_type=payload.document_type,
        custom_notes=payload.custom_notes,
    )
    return doc


@router.get("")
def list_documents_endpoint(
    case_id: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List available generated document artifacts."""
    if case_id:
        case = db.query(Case).filter(Case.id == case_id, Case.user_id == user.id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        cases = [case]
    else:
        cases = db.query(Case).filter(Case.user_id == user.id).all()

    c_ids = [c.id for c in cases]
    # Fetch PDF evidence entries
    evs = db.query(Evidence).filter(Evidence.case_id.in_(c_ids), Evidence.content_type == "application/pdf").all()

    results = []
    for ev in evs:
        results.append({
            "id": ev.id,
            "case_id": ev.case_id,
            "title": ev.original_filename or "Generated Document",
            "sha256": ev.sha256,
            "created_at": ev.created_at.isoformat(),
        })
    return results

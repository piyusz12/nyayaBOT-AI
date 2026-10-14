"""Evidence upload and listing endpoints."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import EvidenceOut
from app.services.case_service import get_case
from app.services.evidence_service import get_evidence_list, store_evidence
from app.services.audit_service import log_event

router = APIRouter(prefix="/api/cases/{case_id}/evidence", tags=["evidence"])


@router.post("", response_model=EvidenceOut, status_code=status.HTTP_201_CREATED)
async def upload_evidence(
    case_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case = get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    file_data = await file.read()
    if len(file_data) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

    evidence = await store_evidence(
        db,
        case_id=case_id,
        file_data=file_data,
        original_filename=file.filename or "unknown",
        content_type=file.content_type or "application/octet-stream",
    )

    log_event(db, case_id=case_id, event_type="evidence_uploaded", actor="user", payload={
        "filename": file.filename,
        "content_type": file.content_type,
        "size_bytes": len(file_data),
        "sha256": evidence.sha256,
        "validation_status": evidence.validation_status,
    })
    db.commit()

    return evidence


@router.get("", response_model=list[EvidenceOut])
def list_evidence(
    case_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case = get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return get_evidence_list(db, case_id)

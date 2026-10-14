"""Audit trail read endpoint."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import AuditEventOut
from app.services.case_service import get_case
from app.services.audit_service import get_audit_trail

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/{case_id}", response_model=list[AuditEventOut])
def audit_trail(
    case_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case = get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return get_audit_trail(db, case_id)

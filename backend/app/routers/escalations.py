"""Escalation endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Escalation, User
from app.schemas import EscalationCreate, EscalationOut
from app.services.case_service import get_case
from app.services.audit_service import log_event

router = APIRouter(prefix="/api/cases/{case_id}/escalations", tags=["escalations"])


@router.post("", response_model=EscalationOut, status_code=status.HTTP_201_CREATED)
def create_escalation(
    case_id: str,
    data: EscalationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case = get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    esc = Escalation(
        case_id=case_id,
        channel=data.channel,
        status="draft",
        details=data.details,
    )
    db.add(esc)
    db.flush()

    log_event(db, case_id=case_id, event_type="escalation_created", actor="user", payload={
        "channel": data.channel,
        "escalation_id": esc.id,
    })
    db.commit()
    db.refresh(esc)
    return esc


@router.get("", response_model=list[EscalationOut])
def list_escalations(
    case_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case = get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return (
        db.query(Escalation)
        .filter(Escalation.case_id == case_id)
        .order_by(Escalation.created_at.desc())
        .all()
    )

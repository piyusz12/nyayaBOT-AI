"""Statutory escalation channel endpoints."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Case, Escalation, User
from app.services.escalation_service import create_escalation

router = APIRouter(prefix="/escalations", tags=["v1-escalations"])


class EscalationCreatePayload(BaseModel):
    case_id: str
    channel: str = "grievance_officer"
    reason: str = "Merchant uncooperative under Section 2(47) CPA 2019"
    details: Optional[Dict[str, Any]] = None


@router.get("")
def list_escalations_endpoint(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all authorized escalations across the user's cases."""
    cases = db.query(Case).filter(Case.user_id == user.id).all()
    case_ids = [c.id for c in cases]

    escalations = (
        db.query(Escalation)
        .filter(Escalation.case_id.in_(case_ids))
        .order_by(Escalation.created_at.desc())
        .all()
    )

    results = []
    for esc in escalations:
        results.append({
            "id": esc.id,
            "case_id": esc.case_id,
            "channel": esc.channel,
            "reference": esc.reference,
            "status": esc.status,
            "details": json.loads(esc.details) if esc.details else {},
            "submitted_at": esc.submitted_at.isoformat() if esc.submitted_at else None,
            "resolved_at": esc.resolved_at.isoformat() if esc.resolved_at else None,
            "created_at": esc.created_at.isoformat(),
        })
    return results


@router.post("", status_code=status.HTTP_201_CREATED)
def create_escalation_endpoint(
    payload: EscalationCreatePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dispatch a new statutory escalation."""
    res = create_escalation(
        db=db,
        user=user,
        case_id=payload.case_id,
        channel=payload.channel,
        reason=payload.reason,
        details=payload.details,
    )
    return res

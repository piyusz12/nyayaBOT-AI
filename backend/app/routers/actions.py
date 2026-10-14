"""Action proposal and approval endpoints."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Action, Approval, User
from app.schemas import ActionCreate, ActionOut, ApprovalDecision, ApprovalOut
from app.services.case_service import get_case
from app.services.audit_service import log_event

router = APIRouter(tags=["actions"])


@router.post(
    "/api/cases/{case_id}/actions",
    response_model=ActionOut,
    status_code=status.HTTP_201_CREATED,
)
def propose_action(
    case_id: str,
    data: ActionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case = get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    payload_str = (
        data.payload if isinstance(data.payload, str)
        else json.dumps(data.payload) if data.payload is not None
        else "{}"
    )
    action = Action(
        case_id=case_id,
        action_type=data.action_type,
        status="proposed",
        payload=payload_str,
    )
    db.add(action)
    db.flush()

    # Auto-create an approval request
    approval = Approval(action_id=action.id)
    db.add(approval)
    db.flush()

    log_event(db, case_id=case_id, event_type="action_proposed", actor="agent", payload={
        "action_type": data.action_type,
        "action_id": action.id,
    })
    db.commit()
    db.refresh(action)
    return action


@router.post("/api/actions/{action_id}/approve", response_model=ApprovalOut)
def approve_or_reject(
    action_id: str,
    data: ApprovalDecision,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    action = db.query(Action).filter(Action.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    # Verify the user owns the case
    case = get_case(db, action.case_id, user.id)
    if not case:
        raise HTTPException(status_code=403, detail="Not authorized")

    approval = action.approval
    if not approval:
        raise HTTPException(status_code=404, detail="Approval record not found")

    if approval.decision is not None:
        raise HTTPException(status_code=409, detail="Already decided")

    approval.decision = data.decision
    approval.decided_at = datetime.now(timezone.utc)
    approval.decided_by = user.id
    approval.notes = data.notes

    # Update action status
    action.status = data.decision  # "approved" or "rejected"

    log_event(db, case_id=action.case_id, event_type=f"action_{data.decision}", actor="user", payload={
        "action_id": action_id,
        "action_type": action.action_type,
        "notes": data.notes,
    })
    db.commit()
    db.refresh(approval)
    return approval


@router.get("/api/cases/{case_id}/actions", response_model=list[ActionOut])
def list_actions(
    case_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case = get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return (
        db.query(Action)
        .filter(Action.case_id == case_id)
        .order_by(Action.created_at.desc())
        .all()
    )

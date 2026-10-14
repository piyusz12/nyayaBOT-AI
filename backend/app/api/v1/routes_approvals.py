"""Approval management endpoints."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.core.exceptions import AuthorizationError, DuplicateSubmissionError, ValidationError
from app.database import get_db
from app.models import Action, Approval, Case, User
from app.services.approval_service import process_hitl_decision

router = APIRouter(prefix="/approvals", tags=["v1-approvals"])


class ApprovalDecidePayload(BaseModel):
    decision: str  # "approved" | "rejected"
    notes: Optional[str] = None


@router.get("")
def list_pending_approvals(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all proposed actions awaiting human approval for authorized cases."""
    cases = db.query(Case).filter(Case.user_id == user.id).all()
    case_ids = [c.id for c in cases]

    actions = (
        db.query(Action)
        .filter(Action.case_id.in_(case_ids), Action.status.in_(["proposed", "pending"]))
        .all()
    )

    results = []
    for a in actions:
        results.append({
            "action_id": a.id,
            "case_id": a.case_id,
            "action_type": a.action_type,
            "status": a.status,
            "payload": json.loads(a.payload) if a.payload else {},
            "created_at": a.created_at.isoformat(),
        })
    return results


@router.post("/{action_id}/decide")
def decide_approval_endpoint(
    action_id: str,
    payload: ApprovalDecidePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit approval or rejection for a specific action."""
    action = db.query(Action).filter(Action.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    case = db.query(Case).filter(Case.id == action.case_id, Case.user_id == user.id).first()
    if not case:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if action.status not in {"proposed", "pending"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Action {action_id} has already been decided with status '{action.status}'.",
        )

    try:
        res = process_hitl_decision(
            db=db,
            user=user,
            case_id=case.id,
            decision=payload.decision,
            notes=payload.notes,
            action_id=action.id,
        )
        return res
    except DuplicateSubmissionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except (ValidationError, AuthorizationError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

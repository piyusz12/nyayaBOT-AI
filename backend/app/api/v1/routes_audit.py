"""Tamper-evident audit trail endpoints."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import AuditEvent, Case, User

router = APIRouter(prefix="/audit", tags=["v1-audit"])


@router.get("")
def list_global_audit_events(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
):
    """List recent audit events across the authenticated user's cases."""
    cases = db.query(Case).filter(Case.user_id == user.id).all()
    c_ids = [c.id for c in cases]

    events = (
        db.query(AuditEvent)
        .filter(AuditEvent.case_id.in_(c_ids))
        .order_by(AuditEvent.timestamp.desc())
        .limit(limit)
        .all()
    )

    results = []
    for ev in events:
        results.append({
            "id": ev.id,
            "case_id": ev.case_id,
            "event_type": ev.event_type,
            "timestamp": ev.timestamp.isoformat(),
            "actor": ev.actor,
            "payload": ev.payload,
        })
    return results


@router.get("/{case_id}")
def get_case_audit_trail(
    case_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve full append-only audit trail for a specific dispute case."""
    case = db.query(Case).filter(Case.id == case_id, Case.user_id == user.id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or unauthorized")

    events = (
        db.query(AuditEvent)
        .filter(AuditEvent.case_id == case.id)
        .order_by(AuditEvent.timestamp.asc())
        .all()
    )

    results = []
    for ev in events:
        results.append({
            "id": ev.id,
            "case_id": ev.case_id,
            "event_type": ev.event_type,
            "timestamp": ev.timestamp.isoformat(),
            "actor": ev.actor,
            "payload": ev.payload,
        })
    return results

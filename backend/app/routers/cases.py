"""Case CRUD, timeline, and dossier endpoints."""

from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    Action,
    AuditEvent,
    Case,
    Conversation,
    Escalation,
    Evidence,
    Message,
    Transaction,
    User,
)
from app.schemas import (
    CaseCreate,
    CaseOut,
    CaseSummary,
    CaseUpdate,
    DossierOut,
    TimelineEntry,
    TimelineResponse,
)
from app.services.case_service import create_case, get_case, list_cases, update_case

router = APIRouter(prefix="/api/cases", tags=["cases"])


@router.post("", response_model=CaseOut, status_code=status.HTTP_201_CREATED)
def create(data: CaseCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    case = create_case(db, user_id=user.id, data=data)
    return case


@router.get("", response_model=list[CaseSummary])
def list_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_cases(db, user.id)


@router.get("/{case_id}", response_model=CaseOut)
def get_one(case_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    case = get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.patch("/{case_id}", response_model=CaseOut)
def update(
    case_id: str,
    data: CaseUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case = update_case(db, case_id, user.id, data)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.get("/{case_id}/dossier", response_model=DossierOut)
def get_dossier(case_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    case = get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if not case.dossier:
        raise HTTPException(status_code=404, detail="Dossier not found")
    return case.dossier


@router.get("/{case_id}/timeline", response_model=TimelineResponse)
def get_timeline(case_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Build a unified timeline from audit events, messages, actions, and escalations."""
    case = get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    entries: list[TimelineEntry] = []

    # Audit events
    for e in (
        db.query(AuditEvent)
        .filter(AuditEvent.case_id == case_id)
        .order_by(AuditEvent.timestamp)
        .all()
    ):
        entries.append(TimelineEntry(
            timestamp=e.timestamp,
            event_type="audit",
            title=e.event_type.replace("_", " ").title(),
            description=e.payload,
            actor=e.actor,
        ))

    # Messages
    for conv in (
        db.query(Conversation).filter(Conversation.case_id == case_id).all()
    ):
        for msg in conv.messages:
            entries.append(TimelineEntry(
                timestamp=msg.occurred_at,
                event_type="message",
                title=f"{msg.sender.title()} message",
                description=msg.content[:200],
                actor=msg.sender,
                metadata=json.dumps({"channel": conv.channel}),
            ))

    # Actions
    for a in (
        db.query(Action).filter(Action.case_id == case_id).all()
    ):
        entries.append(TimelineEntry(
            timestamp=a.created_at,
            event_type="action",
            title=f"Action: {a.action_type.replace('_', ' ').title()}",
            description=f"Status: {a.status}",
            actor="agent",
        ))

    # Evidence
    for ev in (
        db.query(Evidence).filter(Evidence.case_id == case_id).all()
    ):
        entries.append(TimelineEntry(
            timestamp=ev.created_at,
            event_type="evidence",
            title=f"Evidence uploaded: {ev.original_filename or 'file'}",
            description=f"Status: {ev.validation_status}, SHA256: {ev.sha256[:12]}...",
            actor="user",
        ))

    # Escalations
    for esc in (
        db.query(Escalation).filter(Escalation.case_id == case_id).all()
    ):
        entries.append(TimelineEntry(
            timestamp=esc.created_at,
            event_type="escalation",
            title=f"Escalation: {esc.channel.replace('_', ' ').title()}",
            description=f"Status: {esc.status}",
            actor="system",
        ))

    # Transactions
    for tx in (
        db.query(Transaction).filter(Transaction.case_id == case_id).all()
    ):
        ts = tx.transaction_at or tx.created_at
        entries.append(TimelineEntry(
            timestamp=ts,
            event_type="transaction",
            title=f"Transaction: {tx.currency} {tx.amount}",
            description=tx.description,
            actor="user",
        ))

    entries.sort(key=lambda e: e.timestamp)
    return TimelineResponse(case_id=case_id, entries=entries)

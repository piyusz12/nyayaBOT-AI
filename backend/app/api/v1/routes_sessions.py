"""Negotiation session control, SSE streaming, HITL decisions, and emergency killswitch."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Case, Conversation, Dossier, User
from app.services.approval_service import process_hitl_decision
from app.services.audit_service import log_event
from app.services.escalation_service import create_escalation
from app.services.session_service import (
    ACTIVE_SESSIONS,
    generate_sse_events,
    get_or_init_session,
)

router = APIRouter(prefix="/sessions", tags=["v1-sessions"])


class HitlDecisionPayload(BaseModel):
    decision: str = Field(..., description="'approved' or 'rejected'")
    notes: Optional[str] = None
    modified_resolution_floor_inr: Optional[float] = None


class KillswitchPayload(BaseModel):
    reason: Optional[str] = "User invoked emergency escalation override"
    escalate_to: str = "grievance_officer"


@router.post("/{dossier_id}/start")
def start_session_endpoint(
    dossier_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start an autonomous negotiation session for an authorized dossier."""
    case = db.query(Case).filter(Case.id == dossier_id, Case.user_id == user.id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Dossier/Case not found or unauthorized")

    dossier = db.query(Dossier).filter(Dossier.case_id == case.id).first()
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier data not found")

    session_id = str(uuid.uuid4())
    state = get_or_init_session(session_id, case, dossier)
    state["status"] = "NEGOTIATING"

    conv = Conversation(
        id=session_id,
        case_id=case.id,
        channel="ai_negotiation_console",
        status="active",
    )
    db.add(conv)

    log_event(
        db,
        case_id=case.id,
        event_type="negotiation_session_started",
        actor="user",
        payload={
            "session_id": session_id,
            "dossier_id": dossier_id,
            "merchant": case.merchant_name,
        },
    )
    db.commit()

    return {
        "session_id": session_id,
        "dossier_id": dossier_id,
        "case_id": case.id,
        "status": "NEGOTIATING",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "stream_url": f"/api/v1/sessions/{session_id}/stream",
    }


@router.get("/{session_id}")
def get_session_endpoint(
    session_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch live session state and transcript."""
    if session_id not in ACTIVE_SESSIONS:
        conv = db.query(Conversation).filter(Conversation.id == session_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Session not found")
        case = db.query(Case).filter(Case.id == conv.case_id).first()
        dossier = db.query(Dossier).filter(Dossier.case_id == conv.case_id).first()
        if not case or not dossier:
            raise HTTPException(status_code=404, detail="Case associated with session not found")
        get_or_init_session(session_id, case, dossier)

    return ACTIVE_SESSIONS[session_id]


@router.get("/{session_id}/stream")
async def stream_session_endpoint(
    session_id: str,
    db: Session = Depends(get_db),
):
    """Server-Sent Events (SSE) telemetry stream."""
    if session_id not in ACTIVE_SESSIONS:
        conv = db.query(Conversation).filter(Conversation.id == session_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Session not found")
        case = db.query(Case).filter(Case.id == conv.case_id).first()
        dossier = db.query(Dossier).filter(Dossier.case_id == conv.case_id).first()
        if not case or not dossier:
            raise HTTPException(status_code=404, detail="Case associated with session not found")
        get_or_init_session(session_id, case, dossier)

    return StreamingResponse(
        generate_sse_events(session_id, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{session_id}/hitl")
def submit_hitl_endpoint(
    session_id: str,
    payload: HitlDecisionPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit Human-in-the-Loop settlement approval or rejection decision."""
    session = ACTIVE_SESSIONS.get(session_id)
    if not session:
        conv = db.query(Conversation).filter(Conversation.id == session_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Session not found")
        case = db.query(Case).filter(Case.id == conv.case_id).first()
        dossier = db.query(Dossier).filter(Dossier.case_id == conv.case_id).first()
        if not case or not dossier:
            raise HTTPException(status_code=404, detail="Case associated with session not found")
        session = get_or_init_session(session_id, case, dossier)

    result = process_hitl_decision(
        db=db,
        user=user,
        case_id=session["case_id"],
        decision=payload.decision,
        offer_amount_inr=session.get("latest_offer_inr"),
        notes=payload.notes,
        modified_floor_inr=payload.modified_resolution_floor_inr,
    )

    session["status"] = "RESOLVED" if payload.decision.lower() == "approved" else "ESCALATE_EXTERNAL"
    session["pending_hitl"] = None

    return {
        "status": "success",
        "session_id": session_id,
        "decision": payload.decision,
        "new_session_status": session["status"],
        "case_status": result["case_status"],
        "timestamp": result["timestamp"],
    }


@router.post("/{session_id}/killswitch")
def trigger_killswitch_endpoint(
    session_id: str,
    payload: KillswitchPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Emergency halt of autonomous negotiation and dispatch of statutory escalation."""
    session = ACTIVE_SESSIONS.get(session_id)
    if not session:
        conv = db.query(Conversation).filter(Conversation.id == session_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Session not found")
        case = db.query(Case).filter(Case.id == conv.case_id).first()
        dossier = db.query(Dossier).filter(Dossier.case_id == conv.case_id).first()
        if not case or not dossier:
            raise HTTPException(status_code=404, detail="Case associated with session not found")
        session = get_or_init_session(session_id, case, dossier)

    esc_res = create_escalation(
        db=db,
        user=user,
        case_id=session["case_id"],
        channel=payload.escalate_to,
        reason=payload.reason or "Emergency Killswitch invoked",
    )

    session["status"] = "ESCALATE_EXTERNAL"
    session["circuit_breaker_tripped"] = True
    session["current_node"] = "escalation_override"

    return {
        "status": "halted_and_escalated",
        "session_id": session_id,
        "escalation_reference": esc_res["reference"],
        "channel": esc_res["channel"],
        "timestamp": esc_res["submitted_at"],
    }

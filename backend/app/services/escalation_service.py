"""Statutory Escalation Service and State Machine.

Manages escalation workflows across:
1. Company Grievance Redressal Officer (GRO) - 48h statutory acknowledgment (E-Commerce Rules 2020)
2. National Consumer Helpline (NCH - 1915) - CCPA administrative escalation
3. Bank E-Mandate Chargeback Dispute - RBI Framework 2019
4. e-Jagriti / e-Daakhil Portal - Formal District Consumer Disputes Redressal Commission filing
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.core.exceptions import AuthorizationError, NotFoundError, ValidationError
from app.models import Case, Escalation, User
from app.services.audit_service import log_event

ESCALATION_CHANNELS = {
    "grievance_officer": {
        "title": "Company Grievance Redressal Officer (GRO)",
        "statute": "Rule 5(3), Consumer Protection (E-Commerce) Rules, 2020",
        "sla_hours": 48,
    },
    "nch": {
        "title": "National Consumer Helpline (NCH - 1915)",
        "statute": "Section 18, Consumer Protection Act, 2019",
        "sla_hours": 360,
    },
    "bank_dispute": {
        "title": "Bank E-Mandate Dispute & Chargeback",
        "statute": "RBI Master Direction RBI/2019-20/47 Clause 3",
        "sla_hours": 72,
    },
    "e_jagriti": {
        "title": "e-Jagriti (National Consumer Dispute Commission)",
        "statute": "Section 35, Consumer Protection Act, 2019",
        "sla_hours": 720,
    },
}


def create_escalation(
    db: Session,
    user: User,
    case_id: str,
    channel: str,
    reason: str,
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create and persist an escalation workflow record."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise NotFoundError(f"Case with ID {case_id} not found.")

    if case.user_id != user.id:
        raise AuthorizationError("Unauthorized access to case escalation.")

    channel_clean = channel.lower().strip()
    if channel_clean not in ESCALATION_CHANNELS:
        channel_clean = "grievance_officer"

    channel_meta = ESCALATION_CHANNELS[channel_clean]
    ref_code = f"ESC-{case.case_number}-{datetime.now(timezone.utc).strftime('%m%d%H%M')}"

    escalation_details = {
        "reason": reason,
        "statutory_basis": channel_meta["statute"],
        "channel_title": channel_meta["title"],
        "sla_hours": channel_meta["sla_hours"],
        **(details or {}),
    }

    escalation = Escalation(
        case_id=case.id,
        channel=channel_clean,
        reference=ref_code,
        status="submitted",
        details=json.dumps(escalation_details),
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(escalation)

    case.status = "escalated"
    case.updated_at = datetime.now(timezone.utc)

    log_event(
        db,
        case_id=case.id,
        event_type="statutory_escalation_initiated",
        actor="user",
        payload={
            "escalation_id": escalation.id,
            "reference": ref_code,
            "channel": channel_clean,
            "reason": reason,
        },
    )

    db.commit()
    db.refresh(escalation)

    return {
        "escalation_id": escalation.id,
        "case_id": case.id,
        "reference": ref_code,
        "channel": channel_clean,
        "channel_title": channel_meta["title"],
        "statute": channel_meta["statute"],
        "status": escalation.status,
        "submitted_at": escalation.submitted_at.isoformat(),
    }

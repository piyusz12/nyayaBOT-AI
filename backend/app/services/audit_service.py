"""Audit service — append-only event logging for case traceability."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import AuditEvent


def log_event(
    db: Session,
    *,
    case_id: str,
    event_type: str,
    actor: str = "system",
    payload: dict | None = None,
) -> AuditEvent:
    """Create an immutable audit record."""
    event = AuditEvent(
        case_id=case_id,
        event_type=event_type,
        actor=actor,
        payload=json.dumps(payload or {}),
        timestamp=datetime.now(timezone.utc),
    )
    db.add(event)
    db.flush()
    return event


def get_audit_trail(db: Session, case_id: str) -> list[AuditEvent]:
    """Return the full audit trail for a case, ordered chronologically."""
    return (
        db.query(AuditEvent)
        .filter(AuditEvent.case_id == case_id)
        .order_by(AuditEvent.timestamp.asc())
        .all()
    )

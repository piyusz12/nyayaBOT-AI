"""Background SLA tracking and statutory escalation dispatch tasks."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.models import Escalation


def check_statutory_slas(db: Session) -> List[Dict[str, Any]]:
    """Scan active escalations and evaluate SLA compliance."""
    pending_escalations = db.query(Escalation).filter(Escalation.status == "submitted").all()
    results = []
    now = datetime.now(timezone.utc)

    for esc in pending_escalations:
        if esc.submitted_at:
            delta = now - esc.submitted_at.replace(tzinfo=timezone.utc)
            hours_elapsed = delta.total_seconds() / 3600.0
            results.append({
                "escalation_id": esc.id,
                "reference": esc.reference,
                "channel": esc.channel,
                "hours_elapsed": round(hours_elapsed, 2),
            })
            logger.info("Escalation %s in channel %s active for %.1f hours", esc.reference, esc.channel, hours_elapsed)

    return results

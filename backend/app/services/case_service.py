"""Case management service — CRUD, numbering, dossier creation."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Case, Dossier
from app.schemas import CaseCreate, CaseUpdate
from app.services.audit_service import log_event


def _next_case_number(db: Session) -> str:
    """Generate a sequential case number like CASE-0001."""
    count = db.query(Case).count()
    return f"CASE-{count + 1:04d}"


def create_case(db: Session, *, user_id: str, data: CaseCreate) -> Case:
    """Create a new dispute case with an empty dossier."""
    case = Case(
        user_id=user_id,
        case_number=_next_case_number(db),
        merchant_name=data.merchant_name,
        merchant_website=data.merchant_website,
        jurisdiction=data.jurisdiction,
        dispute_type=data.dispute_type,
        status="draft",
        requested_amount=data.requested_amount,
        currency=data.currency,
        requested_resolution=data.requested_resolution,
        accept_store_credit=data.accept_store_credit,
        description=data.description,
    )
    db.add(case)
    db.flush()

    # Create empty dossier
    dossier = Dossier(
        case_id=case.id,
        verified_facts=json.dumps({}),
        resolution_constraints=json.dumps({
            "requested_resolution": data.requested_resolution,
            "accept_store_credit": data.accept_store_credit,
            "minimum_amount": data.requested_amount,
        }),
        missing_fields=json.dumps([]),
    )
    db.add(dossier)
    db.flush()

    log_event(db, case_id=case.id, event_type="case_created", actor="user", payload={
        "merchant": data.merchant_name,
        "dispute_type": data.dispute_type,
        "amount": data.requested_amount,
        "currency": data.currency,
    })

    db.commit()
    db.refresh(case)
    return case


def get_case(db: Session, case_id: str, user_id: str | None = None) -> Case | None:
    """Fetch a single case, optionally scoped to a user."""
    q = db.query(Case).filter(Case.id == case_id)
    if user_id:
        q = q.filter(Case.user_id == user_id)
    return q.first()


def list_cases(db: Session, user_id: str) -> list[Case]:
    """List all cases for a user, newest first."""
    return (
        db.query(Case)
        .filter(Case.user_id == user_id)
        .order_by(Case.created_at.desc())
        .all()
    )


def update_case(db: Session, case_id: str, user_id: str, data: CaseUpdate) -> Case | None:
    """Partially update a case's mutable fields."""
    case = get_case(db, case_id, user_id)
    if not case:
        return None

    update_data = data.model_dump(exclude_unset=True)
    old_values = {}
    for field, value in update_data.items():
        old_values[field] = getattr(case, field)
        setattr(case, field, value)

    case.updated_at = datetime.now(timezone.utc)
    db.flush()

    log_event(db, case_id=case.id, event_type="case_updated", actor="user", payload={
        "changes": update_data,
        "previous": {k: str(v) for k, v in old_values.items()},
    })

    db.commit()
    db.refresh(case)
    return case

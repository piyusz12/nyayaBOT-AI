"""Dossier Intake & Validation Service.

Handles multi-step intake fact verification, constraint serialization,
and business rule enforcement.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.models import Case, Dossier, Transaction
from app.services.audit_service import log_event
from app.services.case_service import _next_case_number


def validate_and_create_dossier(
    db: Session,
    user_id: str,
    payload: Dict[str, Any],
) -> Tuple[Case, Dossier]:
    """Validate intake facts and atomically persist Case and Dossier records."""
    merchant_name = payload.get("merchant_name", "").strip()
    if not merchant_name:
        raise ValidationError("Merchant name is required.")

    disputed_amount = payload.get("disputed_amount_inr")
    if disputed_amount is None or float(disputed_amount) <= 0:
        raise ValidationError("Disputed amount must be a positive numeric value in INR.")

    disputed_amount = float(disputed_amount)
    min_floor = payload.get("min_acceptable_refund_inr")
    if min_floor is not None:
        min_floor = float(min_floor)
        if min_floor < 0 or min_floor > disputed_amount:
            raise ValidationError("Minimum acceptable refund cannot be negative or exceed the disputed amount.")
    else:
        min_floor = round(disputed_amount * 0.8, 2)

    # Compile verified facts
    verified_facts = {
        "merchant_name": merchant_name,
        "merchant_cin": payload.get("merchant_cin"),
        "merchant_website": payload.get("merchant_website"),
        "order_or_account_id": payload.get("order_or_account_id"),
        "transaction_timestamp": payload.get("transaction_timestamp"),
        "e_mandate_ref": payload.get("e_mandate_ref"),
        "cause_of_action_date": payload.get("cause_of_action_date"),
        "pre_debit_notice_received": bool(payload.get("pre_debit_notice_received", False)),
        "dispute_type": payload.get("dispute_type", "subscription_cancellation"),
    }

    # Identify missing optional fields for completeness scoring
    missing_fields = []
    if not payload.get("merchant_cin"):
        missing_fields.append("merchant_cin")
    if not payload.get("order_or_account_id"):
        missing_fields.append("order_or_account_id")
    if not payload.get("e_mandate_ref"):
        missing_fields.append("e_mandate_ref")

    # Compile resolution constraints
    resolution_constraints = {
        "minimum_amount": min_floor,
        "accept_store_credit": bool(payload.get("accept_store_credit", False)),
        "accept_prorated_cancellation": bool(payload.get("accept_prorated_cancellation", True)),
        "require_emandate_revocation": bool(payload.get("require_emandate_revocation", True)),
    }

    # Create Case entity
    case = Case(
        user_id=user_id,
        case_number=_next_case_number(db),
        merchant_name=merchant_name,
        merchant_website=payload.get("merchant_website"),
        jurisdiction="IN",
        dispute_type=payload.get("dispute_type", "subscription_cancellation"),
        status="active",
        requested_amount=disputed_amount,
        currency=payload.get("currency", "INR"),
        requested_resolution=f"Full restitution of INR {disputed_amount:,.2f} and e-mandate cancellation",
        accept_store_credit=bool(payload.get("accept_store_credit", False)),
        description=payload.get("description"),
    )
    db.add(case)
    db.flush()

    # Create Dossier entity
    dossier = Dossier(
        case_id=case.id,
        verified_facts=json.dumps(verified_facts),
        resolution_constraints=json.dumps(resolution_constraints),
        missing_fields=json.dumps(missing_fields),
        evidence_summary=f"Dispute initiated for INR {disputed_amount:,.2f} against {merchant_name}.",
    )
    db.add(dossier)

    # Optional transaction record if reference exists
    if payload.get("order_or_account_id") or payload.get("e_mandate_ref"):
        tx = Transaction(
            case_id=case.id,
            amount=disputed_amount,
            currency="INR",
            order_reference=payload.get("order_or_account_id") or payload.get("e_mandate_ref"),
            description=f"Initial transaction record for {merchant_name}",
        )
        db.add(tx)

    log_event(
        db,
        case_id=case.id,
        event_type="dossier_created",
        actor="user",
        payload={
            "dossier_id": case.id,
            "merchant_name": merchant_name,
            "amount_inr": disputed_amount,
            "resolution_floor_inr": min_floor,
        },
    )

    db.commit()
    db.refresh(case)
    db.refresh(dossier)
    return case, dossier

"""Dossier management endpoints."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Case, Dossier, User
from app.services.dossier_service import validate_and_create_dossier

router = APIRouter(prefix="/dossiers", tags=["v1-dossiers"])


class DossierCreatePayload(BaseModel):
    merchant_name: str
    merchant_cin: Optional[str] = None
    merchant_website: Optional[str] = None
    order_or_account_id: Optional[str] = None
    disputed_amount_inr: float
    currency: str = "INR"
    transaction_timestamp: Optional[str] = None
    e_mandate_ref: Optional[str] = None
    cause_of_action_date: Optional[str] = None
    pre_debit_notice_received: bool = False
    dispute_type: str = "subscription_cancellation"
    description: Optional[str] = None
    min_acceptable_refund_inr: Optional[float] = None
    accept_store_credit: bool = False
    accept_prorated_cancellation: bool = True
    require_emandate_revocation: bool = True


@router.post("", status_code=status.HTTP_201_CREATED)
def create_dossier_endpoint(
    payload: DossierCreatePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Validate and persist a new consumer dispute dossier."""
    try:
        case, dossier = validate_and_create_dossier(
            db=db,
            user_id=user.id,
            payload=payload.model_dump(),
        )
        return {
            "dossier_id": dossier.case_id,
            "case_id": case.id,
            "case_number": case.case_number,
            "merchant_name": case.merchant_name,
            "disputed_amount_inr": case.requested_amount,
            "status": case.status,
            "created_at": case.created_at.isoformat(),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("")
def list_dossiers_endpoint(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all authorized dispute dossiers for the active user."""
    cases = db.query(Case).filter(Case.user_id == user.id).order_by(Case.created_at.desc()).all()
    results = []
    for c in cases:
        results.append({
            "dossier_id": c.id,
            "case_id": c.id,
            "case_number": c.case_number,
            "merchant_name": c.merchant_name,
            "dispute_type": c.dispute_type,
            "disputed_amount_inr": c.requested_amount,
            "status": c.status,
            "created_at": c.created_at.isoformat(),
        })
    return results


@router.get("/{dossier_id}")
def get_dossier_endpoint(
    dossier_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve full details of a specific dossier."""
    case = db.query(Case).filter(Case.id == dossier_id, Case.user_id == user.id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Dossier not found")

    dossier = db.query(Dossier).filter(Dossier.case_id == case.id).first()
    facts = json.loads(dossier.verified_facts) if dossier and dossier.verified_facts else {}
    constraints = json.loads(dossier.resolution_constraints) if dossier and dossier.resolution_constraints else {}

    return {
        "dossier_id": case.id,
        "case_id": case.id,
        "case_number": case.case_number,
        "merchant_name": case.merchant_name,
        "merchant_website": case.merchant_website,
        "jurisdiction": case.jurisdiction,
        "dispute_type": case.dispute_type,
        "status": case.status,
        "requested_amount": case.requested_amount,
        "currency": case.currency,
        "verified_facts": facts,
        "resolution_constraints": constraints,
        "created_at": case.created_at.isoformat(),
        "updated_at": case.updated_at.isoformat() if case.updated_at else None,
    }

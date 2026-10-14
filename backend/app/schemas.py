"""Pydantic schemas for API request/response serialization."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, Union

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ═══════════════════════════════════════════════════════════════════
# User
# ═══════════════════════════════════════════════════════════════════

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: Optional[str] = None
    auth_provider: str
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ═══════════════════════════════════════════════════════════════════
# Case
# ═══════════════════════════════════════════════════════════════════

class MerchantInfo(BaseModel):
    name: str
    legal_entity_verified: bool = False
    website: Optional[str] = None


class CaseCreate(BaseModel):
    merchant_name: str
    merchant_website: Optional[str] = None
    jurisdiction: str = "IN"
    dispute_type: str
    requested_amount: Optional[float] = None
    currency: str = "INR"
    requested_resolution: Optional[str] = None
    accept_store_credit: bool = False
    description: Optional[str] = None


class CaseUpdate(BaseModel):
    status: Optional[str] = None
    requested_amount: Optional[float] = None
    requested_resolution: Optional[str] = None
    accept_store_credit: Optional[bool] = None
    description: Optional[str] = None


class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    case_number: str
    user_id: str
    merchant_name: str
    merchant_legal_entity_verified: bool
    merchant_website: Optional[str]
    jurisdiction: str
    dispute_type: str
    status: str
    requested_amount: Optional[float]
    currency: str
    requested_resolution: Optional[str]
    accept_store_credit: bool
    description: Optional[str]
    created_at: datetime
    updated_at: datetime


class CaseSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    case_number: str
    merchant_name: str
    dispute_type: str
    status: str
    requested_amount: Optional[float]
    currency: str
    created_at: datetime


# ═══════════════════════════════════════════════════════════════════
# Transaction
# ═══════════════════════════════════════════════════════════════════

class TransactionCreate(BaseModel):
    amount: float
    currency: str = "INR"
    transaction_at: Optional[datetime] = None
    order_reference: Optional[str] = None
    payment_method: Optional[str] = None
    description: Optional[str] = None


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    case_id: str
    amount: float
    currency: str
    transaction_at: Optional[datetime]
    order_reference: Optional[str]
    payment_method: Optional[str]
    description: Optional[str]
    created_at: datetime


# ═══════════════════════════════════════════════════════════════════
# Evidence
# ═══════════════════════════════════════════════════════════════════

class EvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    case_id: str
    storage_key: str
    sha256: str
    original_filename: Optional[str]
    content_type: Optional[str]
    file_size_bytes: Optional[float]
    validation_status: str
    ocr_extracted_text: Optional[str]
    created_at: datetime


# ═══════════════════════════════════════════════════════════════════
# Dossier
# ═══════════════════════════════════════════════════════════════════

class DossierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    case_id: str
    verified_facts: str
    resolution_constraints: str
    missing_fields: str
    evidence_summary: Optional[str]
    created_at: datetime
    updated_at: datetime


# ═══════════════════════════════════════════════════════════════════
# Action & Approval
# ═══════════════════════════════════════════════════════════════════

class ActionCreate(BaseModel):
    action_type: str
    payload: Optional[Union[str, dict, list, Any]] = "{}"


class ActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    case_id: str
    action_type: str
    status: str
    payload: str
    result: Optional[str]
    created_at: datetime
    executed_at: Optional[datetime]


class ApprovalDecision(BaseModel):
    decision: str  # "approved" or "rejected"
    notes: Optional[str] = None


class ApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    action_id: str
    decision: Optional[str]
    decided_at: Optional[datetime]
    decided_by: Optional[str]
    notes: Optional[str]
    created_at: datetime


# ═══════════════════════════════════════════════════════════════════
# Escalation
# ═══════════════════════════════════════════════════════════════════

class EscalationCreate(BaseModel):
    channel: str
    details: str = "{}"


class EscalationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    case_id: str
    channel: str
    reference: Optional[str]
    status: str
    details: str
    submitted_at: Optional[datetime]
    resolved_at: Optional[datetime]
    created_at: datetime


# ═══════════════════════════════════════════════════════════════════
# Audit
# ═══════════════════════════════════════════════════════════════════

class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    case_id: str
    event_type: str
    timestamp: datetime
    actor: Optional[str]
    payload: str


# ═══════════════════════════════════════════════════════════════════
# Timeline (aggregated view)
# ═══════════════════════════════════════════════════════════════════

class TimelineEntry(BaseModel):
    timestamp: datetime
    event_type: str
    title: str
    description: Optional[str] = None
    actor: Optional[str] = None
    metadata: Optional[str] = None


class TimelineResponse(BaseModel):
    case_id: str
    entries: list[TimelineEntry]

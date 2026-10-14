"""All Garuda AI ORM models — one file for the MVP, split later if needed."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Enums ────────────────────────────────────────────────────────────

CASE_STATUS = (
    "draft",
    "intake_pending",
    "evidence_review",
    "active",
    "awaiting_approval",
    "escalated",
    "resolved",
    "closed",
)

DISPUTE_TYPES = (
    "subscription_cancellation",
    "unauthorized_charge",
    "refund_request",
    "service_not_delivered",
    "defective_product",
    "billing_error",
    "dark_pattern",
    "other",
)

EVIDENCE_VALIDATION = ("pending", "valid", "invalid", "duplicate")
CONVERSATION_STATUS = ("active", "paused", "completed", "escalated")
ACTION_STATUS = ("proposed", "approved", "rejected", "executed", "failed")
ESCALATION_CHANNELS = ("grievance_officer", "nch", "bank_dispute", "e_jagriti", "other")
ESCALATION_STATUS = ("draft", "submitted", "acknowledged", "resolved", "failed")


# ═══════════════════════════════════════════════════════════════════
# 1. USER
# ═══════════════════════════════════════════════════════════════════

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    auth_provider = Column(String(50), default="local")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    cases = relationship("Case", back_populates="user", cascade="all, delete-orphan")


# ═══════════════════════════════════════════════════════════════════
# 2. CASE
# ═══════════════════════════════════════════════════════════════════

class Case(Base):
    __tablename__ = "cases"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    case_number = Column(String(20), unique=True, nullable=False)

    # Merchant
    merchant_name = Column(String(255), nullable=False)
    merchant_legal_entity_verified = Column(Boolean, default=False)
    merchant_website = Column(String(512), nullable=True)

    # Dispute
    jurisdiction = Column(String(10), default="IN")
    dispute_type = Column(String(50), nullable=False)
    status = Column(String(30), default="draft", index=True)
    requested_amount = Column(Float, nullable=True)
    currency = Column(String(3), default="INR")
    requested_resolution = Column(String(100), nullable=True)
    accept_store_credit = Column(Boolean, default=False)
    description = Column(Text, nullable=True)

    # Approval policy
    external_submission_requires_approval = Column(Boolean, default=True)
    settlement_below_minimum_requires_approval = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    user = relationship("User", back_populates="cases")
    dossier = relationship("Dossier", back_populates="case", uselist=False, cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="case", cascade="all, delete-orphan")
    evidence = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="case", cascade="all, delete-orphan")
    actions = relationship("Action", back_populates="case", cascade="all, delete-orphan")
    escalations = relationship("Escalation", back_populates="case", cascade="all, delete-orphan")
    audit_events = relationship("AuditEvent", back_populates="case", cascade="all, delete-orphan")
    checkpoints = relationship("Checkpoint", back_populates="case", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_cases_user_status", "user_id", "status"),
    )


# ═══════════════════════════════════════════════════════════════════
# 3. DOSSIER
# ═══════════════════════════════════════════════════════════════════

class Dossier(Base):
    __tablename__ = "dossiers"

    case_id = Column(String(36), ForeignKey("cases.id"), primary_key=True)
    verified_facts = Column(Text, default="{}")       # JSON text
    resolution_constraints = Column(Text, default="{}") # JSON text
    missing_fields = Column(Text, default="[]")        # JSON text
    evidence_summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    case = relationship("Case", back_populates="dossier")


# ═══════════════════════════════════════════════════════════════════
# 4. TRANSACTION
# ═══════════════════════════════════════════════════════════════════

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="INR")
    transaction_at = Column(DateTime(timezone=True), nullable=True)
    order_reference = Column(String(255), nullable=True)
    payment_method = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    case = relationship("Case", back_populates="transactions")


# ═══════════════════════════════════════════════════════════════════
# 5. EVIDENCE
# ═══════════════════════════════════════════════════════════════════

class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(String(36), primary_key=True, default=_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    storage_key = Column(String(512), nullable=False)
    sha256 = Column(String(64), nullable=False)
    original_filename = Column(String(255), nullable=True)
    content_type = Column(String(100), nullable=True)
    file_size_bytes = Column(Float, nullable=True)
    validation_status = Column(String(20), default="pending")
    ocr_extracted_text = Column(Text, nullable=True)
    metadata_json = Column(Text, default="{}")
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    case = relationship("Case", back_populates="evidence")


# ═══════════════════════════════════════════════════════════════════
# 6. CONVERSATION
# ═══════════════════════════════════════════════════════════════════

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    channel = Column(String(50), default="web_chat")
    status = Column(String(20), default="active")
    started_at = Column(DateTime(timezone=True), default=_utcnow)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    case = relationship("Case", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan",
                            order_by="Message.occurred_at")


# ═══════════════════════════════════════════════════════════════════
# 7. MESSAGE
# ═══════════════════════════════════════════════════════════════════

class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False, index=True)
    sender = Column(String(50), nullable=False)   # "consumer", "merchant", "agent", "system"
    content = Column(Text, nullable=False)
    occurred_at = Column(DateTime(timezone=True), default=_utcnow)
    trusted_as_instruction = Column(Boolean, default=False)

    conversation = relationship("Conversation", back_populates="messages")


# ═══════════════════════════════════════════════════════════════════
# 8. ACTION
# ═══════════════════════════════════════════════════════════════════

class Action(Base):
    __tablename__ = "actions"

    id = Column(String(36), primary_key=True, default=_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    action_type = Column(String(50), nullable=False)
    status = Column(String(20), default="proposed")
    payload = Column(Text, default="{}")          # JSON text
    result = Column(Text, nullable=True)          # JSON text
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    executed_at = Column(DateTime(timezone=True), nullable=True)

    case = relationship("Case", back_populates="actions")
    approval = relationship("Approval", back_populates="action", uselist=False, cascade="all, delete-orphan")


# ═══════════════════════════════════════════════════════════════════
# 9. APPROVAL
# ═══════════════════════════════════════════════════════════════════

class Approval(Base):
    __tablename__ = "approvals"

    id = Column(String(36), primary_key=True, default=_uuid)
    action_id = Column(String(36), ForeignKey("actions.id"), nullable=False, unique=True)
    decision = Column(String(20), nullable=True)   # "approved", "rejected", None (pending)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    decided_by = Column(String(36), nullable=True)  # user id
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    action = relationship("Action", back_populates="approval")


# ═══════════════════════════════════════════════════════════════════
# 10. ESCALATION
# ═══════════════════════════════════════════════════════════════════

class Escalation(Base):
    __tablename__ = "escalations"

    id = Column(String(36), primary_key=True, default=_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    channel = Column(String(50), nullable=False)
    reference = Column(String(255), nullable=True)
    status = Column(String(20), default="draft")
    details = Column(Text, default="{}")           # JSON text
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    case = relationship("Case", back_populates="escalations")


# ═══════════════════════════════════════════════════════════════════
# 11. AUDIT EVENT
# ═══════════════════════════════════════════════════════════════════

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=_utcnow)
    actor = Column(String(50), nullable=True)        # "user", "agent", "system"
    payload = Column(Text, default="{}")             # JSON text

    case = relationship("Case", back_populates="audit_events")


# ═══════════════════════════════════════════════════════════════════
# 12. CHECKPOINT
# ═══════════════════════════════════════════════════════════════════

class Checkpoint(Base):
    __tablename__ = "checkpoints"

    id = Column(String(36), primary_key=True, default=_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    graph_state_ref = Column(Text, nullable=False)   # Serialized LangGraph state
    step_index = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    case = relationship("Case", back_populates="checkpoints")

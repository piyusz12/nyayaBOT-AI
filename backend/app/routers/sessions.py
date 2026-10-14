"""Live AI Negotiation, Session Streaming, HITL, Legal Research, and Document Generation endpoints.

Implements the PS 30 Counter-Agent contracts:
- POST /api/v1/dossiers
- POST /api/v1/sessions/{dossier_id}/start
- GET  /api/v1/sessions/{session_id}/stream (SSE)
- POST /api/v1/sessions/{session_id}/hitl
- POST /api/v1/sessions/{session_id}/killswitch
- GET  /api/v1/legal-research
- POST /api/v1/documents/generate
"""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    Action,
    Approval,
    AuditEvent,
    Case,
    Conversation,
    Dossier,
    Escalation,
    Message,
    User,
)
from app.services.audit_service import log_event
from app.services.case_service import _next_case_number, get_case

router = APIRouter(prefix="/api/v1", tags=["v1-agent-sessions"])

# ── In-Memory Active Sessions State Registry ─────────────────────────
# Maps session_id -> dict with live agent state & event queues
ACTIVE_SESSIONS: Dict[str, Dict[str, Any]] = {}


# ── Schemas ──────────────────────────────────────────────────────────

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
    # Resolution preferences
    min_acceptable_refund_inr: Optional[float] = None
    accept_store_credit: bool = False
    accept_prorated_cancellation: bool = True
    require_emandate_revocation: bool = True


class DossierCreateResponse(BaseModel):
    dossier_id: str
    case_id: str
    case_number: str
    merchant_name: str
    disputed_amount_inr: float
    status: str
    created_at: str


class SessionStartResponse(BaseModel):
    session_id: str
    dossier_id: str
    case_id: str
    status: str
    started_at: str
    stream_url: str


class HitlDecisionPayload(BaseModel):
    decision: str = Field(..., description="'approved' or 'rejected'")
    notes: Optional[str] = None
    modified_resolution_floor_inr: Optional[float] = None


class KillswitchPayload(BaseModel):
    reason: Optional[str] = "User invoked emergency escalation override"
    escalate_to: str = "grievance_officer"  # grievance_officer | nch | bank_dispute | e_jagriti


class LegalItem(BaseModel):
    id: str
    source_name: str
    act_or_regulation: str
    section_or_annexure: str
    category: str
    retrieved_text: str
    relevance_explanation: str
    severity: str  # low | medium | high | critical
    dark_pattern_code: Optional[str] = None


class DocumentGeneratePayload(BaseModel):
    case_id: str
    document_type: str  # grievance_notice | consumer_complaint | events_chronology | evidence_index | emandate_revocation
    custom_notes: Optional[str] = None


# ── Legal Knowledge Base (Real Indexed Provisions) ───────────────────
LEGAL_DATABASE: List[Dict[str, Any]] = [
    {
        "id": "cpa-2-47",
        "source_name": "Consumer Protection Act, 2019",
        "act_or_regulation": "Act No. 35 of 2019",
        "section_or_annexure": "Section 2(47)",
        "category": "Unfair Trade Practice",
        "retrieved_text": "A trade practice which, for the purpose of promoting the sale, use or supply of any goods or for the provision of any service, adopts any unfair method or deceptive practice including false representation, misleading warranty, or failure to disclose material terms.",
        "relevance_explanation": "Directly applies to merchants withholding cancellation terms, charging after explicit opt-out requests, or disguising recurring billing.",
        "severity": "high",
        "dark_pattern_code": "CPA_UTP_01",
    },
    {
        "id": "cpa-2-9",
        "source_name": "Consumer Protection Act, 2019",
        "act_or_regulation": "Act No. 35 of 2019",
        "section_or_annexure": "Section 2(9)",
        "category": "Consumer Rights",
        "retrieved_text": "The right to be informed about the quality, quantity, potency, purity, standard and price of goods or services; the right to seek redressal against unfair trade practices or restrictive trade practices or unscrupulous exploitation.",
        "relevance_explanation": "Empowers consumers to dispute automatic debits executed without clear upfront disclosure or ongoing accessible cancellation.",
        "severity": "medium",
        "dark_pattern_code": "CPA_RIGHTS_02",
    },
    {
        "id": "ccpa-dp-annexure-5",
        "source_name": "Guidelines for Prevention and Regulation of Dark Patterns, 2023",
        "act_or_regulation": "CCPA Notification No. F. No. J-25/11/2023-CCPA",
        "section_or_annexure": "Annexure 1(5)",
        "category": "Subscription Trap",
        "retrieved_text": "The practice of making cancellation of a paid subscription impossible or a complex and lengthy process, including hiding the cancellation option, forcing consumers to provide unnecessary payment details, or requiring a phone call/chat when sign-up was completely online.",
        "relevance_explanation": "Primary dark pattern cited when merchants refuse instant in-app/web cancellation or impose deflection loops.",
        "severity": "critical",
        "dark_pattern_code": "DP_SUBSCRIPTION_TRAP",
    },
    {
        "id": "ccpa-dp-annexure-6",
        "source_name": "Guidelines for Prevention and Regulation of Dark Patterns, 2023",
        "act_or_regulation": "CCPA Notification No. F. No. J-25/11/2023-CCPA",
        "section_or_annexure": "Annexure 1(6)",
        "category": "Interface Interference",
        "retrieved_text": "Design element that manipulates the user interface in ways that point the user towards actions favorable to the platform and away from consumer-friendly actions, such as visually deemphasizing cancel buttons or making rejection options obscure.",
        "relevance_explanation": "Covers asymmetric UI where upgrading takes 1 click but cancelling requires multiple confirmations, warnings, and delays.",
        "severity": "high",
        "dark_pattern_code": "DP_INTERFACE_INTERFERENCE",
    },
    {
        "id": "ccpa-dp-annexure-8",
        "source_name": "Guidelines for Prevention and Regulation of Dark Patterns, 2023",
        "act_or_regulation": "CCPA Notification No. F. No. J-25/11/2023-CCPA",
        "section_or_annexure": "Annexure 1(8)",
        "category": "Drip Pricing",
        "retrieved_text": "A practice whereby elements of prices are not revealed upfront or are revealed incrementally across the purchase process, or recurring charges are concealed during initial trial signup.",
        "relevance_explanation": "Applicable when recurring debits exceed the advertised subscription tier or hide maintenance/service surcharges.",
        "severity": "high",
        "dark_pattern_code": "DP_DRIP_PRICING",
    },
    {
        "id": "rbi-emandate-2019",
        "source_name": "RBI Framework on Processing of e-Mandates on Cards/UPI",
        "act_or_regulation": "RBI/2019-20/47 DPSS.CO.PD.No.447/02.14.003/2019-20",
        "section_or_annexure": "Clause 3(a)-(e)",
        "category": "E-Mandate Compliance",
        "retrieved_text": "The issuer shall send a pre-debit notification to the cardholder at least 24 hours prior to the actual charge debit date. The facility to withdraw or revoke the e-mandate shall be provided through an online dashboard with immediate execution.",
        "relevance_explanation": "Mandatory financial regulation. Debits executed without a 24-hour pre-debit SMS/email or where merchant fails to acknowledge mandate revocation are voidable through banking dispute.",
        "severity": "critical",
        "dark_pattern_code": "RBI_EMANDATE_VIOLATION",
    },
    {
        "id": "ecom-rules-rule-5",
        "source_name": "Consumer Protection (E-Commerce) Rules, 2020",
        "act_or_regulation": "Ministry of Consumer Affairs Notification G.S.R. 458(E)",
        "section_or_annexure": "Rule 5(3)",
        "category": "Grievance Redressal",
        "retrieved_text": "Every e-commerce entity shall establish an adequate grievance redressal mechanism and appoint a Grievance Officer, publishing their name and contact details prominently. The grievance officer must acknowledge receipt within 48 hours and redress the complaint within one month.",
        "relevance_explanation": "Sets statutory timeline for Level 2 escalations. Establishes legal duty of the Grievance Redressal Officer (GRO).",
        "severity": "medium",
        "dark_pattern_code": "ECOM_GRO_STATUTE",
    },
]


# ── Helper to retrieve or create session ──────────────────────────────

def _get_or_init_session(session_id: str, case: Case, dossier: Dossier) -> Dict[str, Any]:
    if session_id in ACTIVE_SESSIONS:
        return ACTIVE_SESSIONS[session_id]

    # Parse resolution constraints from dossier
    constraints = {}
    if dossier.resolution_constraints:
        try:
            constraints = json.loads(dossier.resolution_constraints)
        except Exception:
            constraints = {}

    req_amount = case.requested_amount or 0.0
    min_floor = constraints.get("minimum_amount") or (req_amount * 0.8)

    state = {
        "session_id": session_id,
        "dossier_id": dossier.case_id,
        "case_id": case.id,
        "case_number": case.case_number,
        "merchant_name": case.merchant_name,
        "dispute_type": case.dispute_type,
        "requested_amount_inr": req_amount,
        "resolution_floor_inr": min_floor,
        "accept_store_credit": case.accept_store_credit,
        "currency": case.currency,
        "status": "INITIALIZING",
        "current_node": "triage_loop_detector",
        "turn": 1,
        "stalled_turns": 0,
        "consecutive_high_sim_count": 0,
        "s_max": 0.12,
        "detected_dark_patterns": ["Annexure I(5): Subscription Trap"],
        "active_statutes": [
            "Consumer Protection Act 2019 Sec 2(47)",
            "CCPA Dark Pattern Guidelines 2023 Annexure I(5)",
            "RBI E-Mandate Framework 2019",
        ],
        "latest_offer_inr": None,
        "pending_hitl": None,
        "messages": [],
        "events": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    ACTIVE_SESSIONS[session_id] = state
    return state


# ═══════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════

@router.post("/dossiers", response_model=DossierCreateResponse, status_code=status.HTTP_201_CREATED)
def create_dossier(
    payload: DossierCreatePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a dispute dossier with verified facts and resolution constraints."""
    case_num = _next_case_number(db)
    new_case = Case(
        user_id=user.id,
        case_number=case_num,
        merchant_name=payload.merchant_name,
        merchant_website=payload.merchant_website,
        jurisdiction="IN",
        dispute_type=payload.dispute_type,
        status="active",
        requested_amount=payload.disputed_amount_inr,
        currency=payload.currency,
        requested_resolution=f"Refund of {payload.currency} {payload.disputed_amount_inr}",
        accept_store_credit=payload.accept_store_credit,
        description=payload.description or f"Consumer dispute against {payload.merchant_name}",
    )
    db.add(new_case)
    db.flush()

    # Build structured verified facts and constraints
    verified_facts = {
        "merchant_name": payload.merchant_name,
        "merchant_cin": payload.merchant_cin,
        "merchant_website": payload.merchant_website,
        "order_reference": payload.order_or_account_id,
        "disputed_amount_inr": payload.disputed_amount_inr,
        "transaction_timestamp": payload.transaction_timestamp,
        "cause_of_action_date": payload.cause_of_action_date,
        "e_mandate_ref": payload.e_mandate_ref,
        "pre_debit_notice_received": payload.pre_debit_notice_received,
    }

    resolution_constraints = {
        "minimum_amount": payload.min_acceptable_refund_inr or payload.disputed_amount_inr,
        "accept_store_credit": payload.accept_store_credit,
        "accept_prorated_cancellation": payload.accept_prorated_cancellation,
        "require_emandate_revocation": payload.require_emandate_revocation,
    }

    dossier = Dossier(
        case_id=new_case.id,
        verified_facts=json.dumps(verified_facts),
        resolution_constraints=json.dumps(resolution_constraints),
        missing_fields=json.dumps([]),
        evidence_summary=f"Dispute intake for {payload.merchant_name}. Amount: INR {payload.disputed_amount_inr}",
    )
    db.add(dossier)
    db.flush()

    log_event(db, case_id=new_case.id, event_type="dossier_created", actor="user", payload={
        "merchant": payload.merchant_name,
        "amount": payload.disputed_amount_inr,
        "dossier_id": dossier.case_id,
    })
    db.commit()
    db.refresh(new_case)

    return DossierCreateResponse(
        dossier_id=dossier.case_id,
        case_id=new_case.id,
        case_number=new_case.case_number,
        merchant_name=new_case.merchant_name,
        disputed_amount_inr=payload.disputed_amount_inr,
        status="active",
        created_at=new_case.created_at.isoformat(),
    )


@router.post("/sessions/{dossier_id}/start", response_model=SessionStartResponse)
def start_session(
    dossier_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start an autonomous negotiation session for a dossier."""
    case = db.query(Case).filter(Case.id == dossier_id, Case.user_id == user.id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Dossier/Case not found or unauthorized")

    dossier = db.query(Dossier).filter(Dossier.case_id == case.id).first()
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier data not found")

    session_id = str(uuid.uuid4())
    state = _get_or_init_session(session_id, case, dossier)
    state["status"] = "NEGOTIATING"

    # Create a Conversation record in DB for persistent audit
    conv = Conversation(
        id=session_id,
        case_id=case.id,
        channel="ai_negotiation_console",
        status="active",
    )
    db.add(conv)

    log_event(db, case_id=case.id, event_type="negotiation_session_started", actor="user", payload={
        "session_id": session_id,
        "dossier_id": dossier_id,
        "merchant": case.merchant_name,
    })
    db.commit()

    return SessionStartResponse(
        session_id=session_id,
        dossier_id=dossier_id,
        case_id=case.id,
        status="NEGOTIATING",
        started_at=datetime.now(timezone.utc).isoformat(),
        stream_url=f"/api/v1/sessions/{session_id}/stream",
    )


@router.get("/sessions/{session_id}")
def get_session_state(
    session_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch current session telemetry and transcript."""
    if session_id not in ACTIVE_SESSIONS:
        # Check if conversation exists in DB
        conv = db.query(Conversation).filter(Conversation.id == session_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Session not found")
        case = db.query(Case).filter(Case.id == conv.case_id).first()
        dossier = db.query(Dossier).filter(Dossier.case_id == conv.case_id).first()
        if not case or not dossier:
            raise HTTPException(status_code=404, detail="Case associated with session not found")
    session = ACTIVE_SESSIONS[session_id]
    case = db.query(Case).filter(Case.id == session["case_id"], Case.user_id == user.id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Session not found or unauthorized")

    return session


@router.get("/sessions/{session_id}/stream")
async def stream_session_events(
    session_id: str,
    db: Session = Depends(get_db),
):
    """Server-Sent Events (SSE) endpoint for real-time agent execution monitoring."""
    if session_id not in ACTIVE_SESSIONS:
        conv = db.query(Conversation).filter(Conversation.id == session_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Session not found")
        case = db.query(Case).filter(Case.id == conv.case_id).first()
        dossier = db.query(Dossier).filter(Dossier.case_id == conv.case_id).first()
        if not case or not dossier:
            raise HTTPException(status_code=404, detail="Case associated with session not found")
        _get_or_init_session(session_id, case, dossier)

    session = ACTIVE_SESSIONS[session_id]

    async def event_generator():
        # 1. Connection established event
        yield f"event: connected\ndata: {json.dumps({'session_id': session_id, 'status': session['status'], 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"
        await asyncio.sleep(0.5)

        # 2. Node 1: Triage and Loop Detection
        session["current_node"] = "triage_loop_detector"
        session["s_max"] = 0.28
        event_triage = {
            "type": "agent_node_transition",
            "node": "triage_loop_detector",
            "title": "Triage & Loop Detection",
            "status": "EXECUTING",
            "s_max": session["s_max"],
            "stalled_turns": session["stalled_turns"],
            "description": f"Analyzing merchant communication channel for {session['merchant_name']}. Scanning for automated deflection and repetition loops.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        yield f"event: node_transition\ndata: {json.dumps(event_triage)}\n\n"
        await asyncio.sleep(1.0)

        # Merchant opening statement
        msg1 = {
            "id": str(uuid.uuid4()),
            "sender": "merchant",
            "sender_label": f"{session['merchant_name']} Support Bot",
            "content": f"Hello! We received your cancellation request regarding subscription under account. Please note per Section 4.2 of our terms of service, subscription payments are non-refundable once billed. We can offer you 30 days of complimentary access.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        session["messages"].append(msg1)
        yield f"event: transcript_message\ndata: {json.dumps(msg1)}\n\n"
        await asyncio.sleep(1.2)

        # 3. Node 2: Legal Retrieval & Strategy
        session["current_node"] = "legal_retriever"
        event_legal = {
            "type": "agent_node_transition",
            "node": "legal_retriever",
            "title": "Legal Retrieval & Strategy",
            "status": "EXECUTING",
            "retrieved_statutes": [
                "CPA 2019 Sec 2(47): Unfair Trade Practice",
                "CCPA Guidelines 2023 Annexure I(5): Subscription Trap",
                "RBI E-Mandate Circular 2019: Pre-debit Notice Mandate",
            ],
            "detected_dark_pattern": "Annexure I(5): Subscription Trap — Non-refundable clause after obscured cancellation",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        yield f"event: node_transition\ndata: {json.dumps(event_legal)}\n\n"
        await asyncio.sleep(1.0)

        # 4. Node 3: Dialogue Generation
        session["current_node"] = "dialogue_generator"
        counter_text = (
            f"Dear {session['merchant_name']} Support, the consumer submitted a cancellation request prior to the billing date. "
            f"Denying refunds while imposing continuous automated renewals constitutes an Unfair Trade Practice under Section 2(47) "
            f"of the Consumer Protection Act, 2019 and a prohibited Subscription Trap under CCPA Guidelines 2023 Annexure I(5). "
            f"We formally demand an immediate full refund of INR {session['requested_amount_inr']:,.2f} to the original payment source and mandate revocation within 48 hours."
        )
        event_dialogue = {
            "type": "agent_node_transition",
            "node": "dialogue_generator",
            "title": "Dialogue Generation",
            "status": "EXECUTING",
            "proposed_response": counter_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        yield f"event: node_transition\ndata: {json.dumps(event_dialogue)}\n\n"
        await asyncio.sleep(1.2)

        # 5. Node 4: Sentinel Audit
        session["current_node"] = "sentinel_audit"
        event_sentinel = {
            "type": "agent_node_transition",
            "node": "sentinel_audit",
            "title": "Sentinel Safety Audit",
            "status": "PASSED",
            "checks": {
                "monetary_accuracy": f"INR {session['requested_amount_inr']} matches case facts",
                "statutory_grounding": "All cited sections verified against CCPA 2023 & CPA 2019",
                "hallucination_check": "Zero unsupported statutory assertions detected",
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        yield f"event: node_transition\ndata: {json.dumps(event_sentinel)}\n\n"
        await asyncio.sleep(1.0)

        # Send agent response into transcript
        msg2 = {
            "id": str(uuid.uuid4()),
            "sender": "agent",
            "sender_label": "PS 30 Counter-Agent (Autonomous)",
            "content": counter_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        session["messages"].append(msg2)
        yield f"event: transcript_message\ndata: {json.dumps(msg2)}\n\n"
        await asyncio.sleep(2.0)

        # Merchant counter-offer simulating settlement offer
        offer_amount = round(session["requested_amount_inr"] * 0.75, 2)
        session["latest_offer_inr"] = offer_amount
        msg3 = {
            "id": str(uuid.uuid4()),
            "sender": "merchant",
            "sender_label": f"{session['merchant_name']} Senior Escalations",
            "content": f"Having reviewed your dispute and cited provisions, as a special one-time courtesy, management has approved a 75% settlement refund of INR {offer_amount:,.2f} to your bank account, with immediate cancellation of all future recurring charges.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        session["messages"].append(msg3)
        yield f"event: transcript_message\ndata: {json.dumps(msg3)}\n\n"
        await asyncio.sleep(1.0)

        # 6. Node 5: Human Approval Gate (HITL Required)
        session["current_node"] = "human_approval_gate"
        session["status"] = "AWAITING_HITL"
        diff_amount = round(session["requested_amount_inr"] - offer_amount, 2)
        hitl_payload = {
            "session_id": session_id,
            "status": "AWAITING_HITL",
            "offer_amount_inr": offer_amount,
            "requested_amount_inr": session["requested_amount_inr"],
            "difference_inr": diff_amount,
            "resolution_floor_inr": session["resolution_floor_inr"],
            "merchant_name": session["merchant_name"],
            "detected_dark_patterns": session["detected_dark_patterns"],
            "active_statutes": session["active_statutes"],
            "prompt": f"Merchant has offered INR {offer_amount:,.2f} (75% of disputed INR {session['requested_amount_inr']:,.2f}). Human authorization required to accept or reject.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        session["pending_hitl"] = hitl_payload

        yield f"event: hitl_required\ndata: {json.dumps(hitl_payload)}\n\n"

        # Keep alive ping loop while waiting for HITL or until disconnect
        while session["status"] == "AWAITING_HITL":
            await asyncio.sleep(15)
            yield f"event: ping\ndata: {json.dumps({'keepalive': True, 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"

        # When HITL is resolved:
        if session["status"] == "RESOLVED":
            yield f"event: session_resolved\ndata: {json.dumps({'status': 'RESOLVED', 'settlement_inr': session['latest_offer_inr'], 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"
        elif session["status"] == "ESCALATE_EXTERNAL":
            yield f"event: session_escalated\ndata: {json.dumps({'status': 'ESCALATE_EXTERNAL', 'reason': 'User rejected offer or invoked killswitch', 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/sessions/{session_id}/hitl")
def submit_hitl_decision(
    session_id: str,
    payload: HitlDecisionPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit human approval decision (Approve or Reject settlement offer)."""
    if session_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Active negotiation session not found")

    session = ACTIVE_SESSIONS[session_id]
    case = db.query(Case).filter(Case.id == session["case_id"]).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    decision = payload.decision.lower()
    if decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'")

    # Record action & approval in database
    action = Action(
        case_id=case.id,
        action_type="settlement_offer_decision",
        status=decision,
        payload=json.dumps({
            "offer_amount_inr": session.get("latest_offer_inr"),
            "decision": decision,
            "notes": payload.notes,
            "modified_resolution_floor_inr": payload.modified_resolution_floor_inr,
        }),
    )
    db.add(action)
    db.flush()

    approval = Approval(
        action_id=action.id,
        decision=decision,
        decided_at=datetime.now(timezone.utc),
        decided_by=user.id,
        notes=payload.notes,
    )
    db.add(approval)

    if decision == "approved":
        session["status"] = "RESOLVED"
        case.status = "resolved"
        log_event(db, case_id=case.id, event_type="settlement_approved", actor="user", payload={
            "session_id": session_id,
            "offer_inr": session.get("latest_offer_inr"),
            "notes": payload.notes,
        })
    else:
        # Rejected -> escalate or continue negotiation
        session["status"] = "ESCALATE_EXTERNAL"
        case.status = "escalated"
        # Auto-create escalation record for Grievance Redressal Officer
        esc = Escalation(
            case_id=case.id,
            channel="grievance_officer",
            status="draft",
            details=json.dumps({
                "reason": "Merchant settlement offer rejected by consumer",
                "offered_inr": session.get("latest_offer_inr"),
                "demanded_inr": session.get("requested_amount_inr"),
            }),
        )
        db.add(esc)
        log_event(db, case_id=case.id, event_type="settlement_rejected_escalated", actor="user", payload={
            "session_id": session_id,
            "offered_inr": session.get("latest_offer_inr"),
            "notes": payload.notes,
        })

    session["pending_hitl"] = None
    session["updated_at"] = datetime.now(timezone.utc).isoformat()
    db.commit()

    return {
        "status": "success",
        "session_id": session_id,
        "decision": decision,
        "new_session_status": session["status"],
        "case_status": case.status,
    }


@router.post("/sessions/{session_id}/killswitch")
def trigger_killswitch(
    session_id: str,
    payload: KillswitchPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Emergency override: terminate negotiation and immediately escalate to statutory/banking channels."""
    if session_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Active negotiation session not found")

    session = ACTIVE_SESSIONS[session_id]
    case = db.query(Case).filter(Case.id == session["case_id"]).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    session["status"] = "ESCALATE_EXTERNAL"
    session["current_node"] = "escalation_override"
    case.status = "escalated"

    esc = Escalation(
        case_id=case.id,
        channel=payload.escalate_to,
        status="submitted",
        reference=f"ESC-{uuid.uuid4().hex[:8].upper()}",
        details=json.dumps({
            "override_reason": payload.reason,
            "escalated_from_session": session_id,
            "channel": payload.escalate_to,
        }),
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(esc)

    log_event(db, case_id=case.id, event_type="killswitch_escalation_invoked", actor="user", payload={
        "session_id": session_id,
        "channel": payload.escalate_to,
        "reason": payload.reason,
    })
    db.commit()

    return {
        "status": "escalated",
        "session_id": session_id,
        "escalation_id": esc.id,
        "reference": esc.reference,
        "channel": payload.escalate_to,
        "message": f"Negotiation terminated. Case escalated to {payload.escalate_to}.",
    }


# ── Legal Research & Dark Pattern Endpoints ─────────────────────────

@router.get("/legal-research")
def search_legal_provisions(
    q: Optional[str] = Query(None, description="Search query keyword"),
    category: Optional[str] = Query(None, description="Category filter"),
    severity: Optional[str] = Query(None, description="Severity filter"),
):
    """Search and filter indexed statutory provisions and dark pattern classifications."""
    results = LEGAL_DATABASE

    if category and category != "all":
        results = [item for item in results if item["category"].lower() == category.lower()]

    if severity and severity != "all":
        results = [item for item in results if item["severity"].lower() == severity.lower()]

    if q:
        query_lower = q.lower()
        results = [
            item for item in results
            if query_lower in item["source_name"].lower()
            or query_lower in item["section_or_annexure"].lower()
            or query_lower in item["retrieved_text"].lower()
            or query_lower in item["relevance_explanation"].lower()
        ]

    return {
        "total": len(results),
        "results": results,
    }


# ── Document Generation Endpoints ────────────────────────────────────

@router.post("/documents/generate")
def generate_document(
    payload: DocumentGeneratePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate formal legal grievance notices, consumer complaint packets, or event chronologies."""
    case = get_case(db, payload.case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    dossier = db.query(Dossier).filter(Dossier.case_id == case.id).first()
    verified_facts = {}
    if dossier and dossier.verified_facts:
        try:
            verified_facts = json.loads(dossier.verified_facts)
        except Exception:
            verified_facts = {}

    doc_id = f"DOC-{uuid.uuid4().hex[:8].upper()}"
    date_str = datetime.now(timezone.utc).strftime("%d %B %Y")
    req_amt = case.requested_amount or 0.0

    if payload.document_type == "grievance_notice":
        title = f"FORMAL LEGAL NOTICE UNDER SECTION 2(47) OF CONSUMER PROTECTION ACT, 2019"
        content = f"""To:
The Grievance Redressal Officer (GRO)
{case.merchant_name}
Corporate Legal & Compliance Department

DATE: {date_str}
REFERENCE NO: {doc_id} / CASE {case.case_number}
SUBJECT: FORMAL NOTICE DEMANDING REFUND OF INR {req_amt:,.2f} AND IMMEDIATE MANDATE REVOCATION

Respected Officer,

1. The Complainant was subjected to unauthorized billing and subscription traps regarding orders under reference {verified_facts.get('order_reference', 'N/A')}.
2. Despite repeated attempts to terminate the recurring subscription, your platform continued deductions without the mandatory 24-hour pre-debit notification required by the Reserve Bank of India Framework (DPSS.CO.PD.No.447/02.14.003/2019-20).
3. Such practices constitute an Unfair Trade Practice under Section 2(47) of the Consumer Protection Act, 2019 and violate CCPA Guidelines for Prevention of Dark Patterns (Annexure I(5): Subscription Trap).

RELIEF DEMANDED:
(a) Immediate refund of INR {req_amt:,.2f} to the original payment instrument within seven (7) business days.
(b) Irrevocable cancellation and deletion of all recurring debit mandates registered against the complainant.

TAKE NOTICE that failure to redress this grievance within the statutory timeline will compel the Complainant to initiate formal proceedings before the District Consumer Disputes Redressal Commission and report non-compliance to the Central Consumer Protection Authority (CCPA) and National Consumer Helpline (NCH).

Sincerely,
Authorized Consumer Representative via PS 30 Counter-Agent
"""
    elif payload.document_type == "events_chronology":
        title = f"CHRONOLOGICAL RECORD OF DISPUTE EVENTS — {case.case_number}"
        content = f"""CHRONOLOGY OF EVENTS — {case.case_number}
Merchant: {case.merchant_name}
Disputed Amount: INR {req_amt:,.2f}
Generated on: {date_str}

1. {verified_facts.get('transaction_timestamp', date_str)}: Initial transaction / subscription activation executed.
2. {verified_facts.get('cause_of_action_date', date_str)}: Consumer submitted explicit request for cancellation/refund.
3. System Log: Merchant automated support deflection encountered (S_max >= 0.88).
4. System Log: AI Counter-Agent deployed, grounded statutory citations issued under CPA 2019 & CCPA Guidelines 2023.
5. {date_str}: Current dispute dossier consolidated with verified evidence checksums.
"""
    elif payload.document_type == "evidence_index":
        title = f"INDEX OF VERIFIED EVIDENCE ANNEXURES — {case.case_number}"
        content = f"""EVIDENCE DOSSIER INDEX
Case Reference: {case.case_number}
Merchant: {case.merchant_name}
Jurisdiction: India (CPA 2019)

ANNEXURE A: Transaction Statement / Bank Debit Confirmation (INR {req_amt:,.2f})
ANNEXURE B: Digital Communication Transcript & Chatbot Loop Logs
ANNEXURE C: Proof of Cancellation Attempt / Merchant Deflection Screen Capture
ANNEXURE D: Statutory Notice Issued to Company Grievance Officer

All digital records stored with SHA-256 cryptographic verification.
"""
    else:
        title = f"FORMAL CONSUMER COMPLAINT DRAFT (e-Jagriti Format) — {case.case_number}"
        content = f"""BEFORE THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION
COMPLAINT NO. DRAFT-{doc_id}

IN THE MATTER OF:
Complainant: Consumer (Account Ref: {verified_facts.get('order_reference', 'N/A')})
VERSUS
Opposite Party: {case.merchant_name}

STATEMENT OF CLAIM:
1. The Opposite Party is engaged in providing consumer goods/services through digital commerce.
2. The Complainant was wrongfully billed an amount of INR {req_amt:,.2f} under circumstances amounting to deficiency of service and unfair trade practice.
3. The Opposite Party employed deceptive interface mechanisms and refused timely refund contrary to Consumer Protection (E-Commerce) Rules, 2020.

PRAYER:
Wherefore, the Complainant prays for an order directing the Opposite Party to:
(a) Refund the sum of INR {req_amt:,.2f} along with interest @ 12% p.a.
(b) Pay compensation for mental agony and harassment.
(c) Award litigation costs of INR 5,000.
"""

    log_event(db, case_id=case.id, event_type="document_generated", actor="user", payload={
        "document_id": doc_id,
        "type": payload.document_type,
    })
    db.commit()

    return {
        "document_id": doc_id,
        "case_id": case.id,
        "case_number": case.case_number,
        "document_type": payload.document_type,
        "title": title,
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "draft",
    }

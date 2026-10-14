"""Legal Document Generation Service.

Generates:
1. Formal Grievance Notice to GRO (Rule 5(3), E-Commerce Rules 2020)
2. Consumer Commission Complaint Draft (Section 35, CPA 2019)
3. Chronological Statement of Events
4. Evidence Index Ledger
5. PDF compilation via ReportLab

Adheres strictly to DPDP Act 2023 (never embeds unverified PII, Aadhaar, or signing credentials).
"""

from __future__ import annotations

import io
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.core.exceptions import NotFoundError, ValidationError
from app.models import Case, Dossier, Evidence, User
from app.services.audit_service import log_event
from app.storage.evidence_storage import storage


def generate_grievance_notice_text(case: Case, dossier: Dossier, custom_notes: Optional[str] = None) -> str:
    """Generate formal notice addressed to Merchant Grievance Redressal Officer."""
    now_str = datetime.now(timezone.utc).strftime("%d %B %Y")
    amt = case.requested_amount or 0.0

    facts = {}
    if dossier.verified_facts:
        try:
            facts = json.loads(dossier.verified_facts)
        except Exception:
            pass

    order_id = facts.get("order_or_account_id") or "N/A"
    emandate = facts.get("e_mandate_ref") or "N/A"

    notice = f"""FORMAL GRIEVANCE NOTICE UNDER RULE 5(3) OF CONSUMER PROTECTION (E-COMMERCE) RULES, 2020

DATE: {now_str}
REFERENCE: {case.case_number}
TO: The Grievance Redressal Officer (GRO), {case.merchant_name}

SUBJECT: FORMAL COMPLAINT REGARDING UNLAWFUL SUBSCRIPTION DEBIT AND NON-COMPLIANCE WITH CANCELLATION DIRECTIVES (TRANSACTION ID: {order_id})

Respected Grievance Officer,

1. PRELIMINARY STATEMENT:
This formal grievance is lodged on behalf of the consumer regarding an unauthorized or contested recurring debit of INR {amt:,.2f} executed by {case.merchant_name}. Despite timely opt-out requests, recurring charges have continued without affirmative consent.

2. STATUTORY VIOLATIONS:
a) Consumer Protection Act, 2019 [Section 2(47)]:
The refusal to provide immediate, accessible in-platform subscription cancellation constitutes an Unfair Trade Practice.
b) Guidelines for Prevention and Regulation of Dark Patterns, 2023 [Annexure 1(5) - Subscription Trap]:
Obstructing immediate online cancellation of a service subscribed to online is an explicitly prohibited dark pattern.
c) RBI Framework on E-Mandates (RBI/2019-20/47):
Failure to provide mandatory 24-hour pre-debit notifications and immediate mandate revocation facilities renders the debit voidable.

3. DETAILS OF DISPUTE:
- Merchant Legal Entity: {case.merchant_name}
- Order / Transaction ID: {order_id}
- E-Mandate Reference: {emandate}
- Disputed Claim Amount: INR {amt:,.2f}
{f"- Additional Facts: {custom_notes}" if custom_notes else ""}

4. FORMAL DEMAND & 48-HOUR STATUTORY ACKNOWLEDGMENT:
Pursuant to Rule 5(3) of the Consumer Protection (E-Commerce) Rules, 2020, you are statutorily required to:
(i) Acknowledge receipt of this grievance within 48 hours;
(ii) Issue a full reversal of INR {amt:,.2f} to the original payment instrument;
(iii) Provide written confirmation of e-mandate revocation within 7 business days.

Failing receipt of satisfactory redressal within the statutory window, this dispute will be escalated to the Central Consumer Protection Authority (CCPA) and the District Consumer Disputes Redressal Commission under Section 35 of the CPA 2019.

Yours sincerely,
Authorized Consumer Representative
[Generated via PS 30 Counter-Agent Engine — Reference {case.case_number}]
"""
    return notice.strip()


def generate_complaint_draft_text(case: Case, dossier: Dossier, custom_notes: Optional[str] = None) -> str:
    """Generate formal Consumer Forum complaint draft under Section 35, CPA 2019."""
    now_str = datetime.now(timezone.utc).strftime("%d %B %Y")
    amt = case.requested_amount or 0.0

    complaint = f"""BEFORE THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION
CONSUMER COMPLAINT NO. ________ / 2026
(Under Section 35 of the Consumer Protection Act, 2019)

IN THE MATTER OF:
Complainant (Aggrieved Consumer)
VERSUS
{case.merchant_name} (Opposite Party)

STATEMENT OF CLAIM & PRAYER FOR RELIEF

1. The Complainant is a consumer within the meaning of Section 2(7) of the Consumer Protection Act, 2019.
2. The Opposite Party is an enterprise providing digital services and recurring billing facilities.
3. On or about the transaction date, Opposite Party deducted INR {amt:,.2f} through an automated e-mandate without requisite affirmative authorization or pre-debit notification.
4. Opposite Party engaged in prohibited dark patterns as defined under CCPA Notification No. F. No. J-25/11/2023-CCPA (Subscription Trap & Interface Interference).
5. The Complainant has suffered direct financial loss and mental harassment.

PRAYER:
WHEREFORE, it is respectfully prayed that this Hon'ble Commission may be pleased to:
a) Direct Opposite Party to refund the disputed sum of INR {amt:,.2f} with 12% interest per annum;
b) Award damages of INR 10,000 for mental agony and deficiency in service;
c) Award litigation costs of INR 5,000;
d) Pass any other relief deemed fit in the interest of justice.

DATED: {now_str}
PLACE: Jurisdiction of Record
"""
    return complaint.strip()


def compile_pdf_document(title: str, body_text: str) -> bytes:
    """Compile formatted PDF document using ReportLab."""
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # Header
    p.setFont("Helvetica-Bold", 14)
    p.drawString(50, height - 50, title[:60])
    p.setFont("Helvetica", 9)
    p.drawString(50, height - 68, f"PS 30 COUNTER-AGENT LEGAL ENGINE — CONFIDENTIAL LEGAL DRAFT — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%SZ')}")
    p.line(50, height - 74, width - 50, height - 74)

    # Body
    p.setFont("Helvetica", 9)
    y = height - 95
    line_height = 13

    for line in body_text.split("\n"):
        if y < 50:
            p.showPage()
            p.setFont("Helvetica", 9)
            y = height - 50
        p.drawString(50, y, line[:95])
        y -= line_height

    p.save()
    buffer.seek(0)
    return buffer.getvalue()


def generate_document(
    db: Session,
    case_id: str,
    document_type: str,
    custom_notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate, compile, and record a formal legal document artifact."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise NotFoundError(f"Case with ID {case_id} not found.")

    dossier = db.query(Dossier).filter(Dossier.case_id == case.id).first()
    if not dossier:
        raise NotFoundError(f"Dossier for case {case_id} not found.")

    doc_id = f"DOC-{uuid.uuid4().hex[:8].upper()}"

    if document_type == "consumer_complaint":
        title = f"District Consumer Commission Complaint — {case.merchant_name}"
        content = generate_complaint_draft_text(case, dossier, custom_notes)
    elif document_type == "events_chronology":
        title = f"Chronological Statement of Facts — {case.merchant_name}"
        content = f"CHRONOLOGICAL STATEMENT OF FACTS\nCASE: {case.case_number}\n\n1. Initial Transaction: Disputed charge of INR {case.requested_amount:,.2f}.\n2. Dispute Notice: Formal cancellation communication logged.\n3. Escalation: Proceeding under Consumer Protection Act 2019."
    elif document_type == "evidence_index":
        title = f"Evidence Ledger Index — {case.merchant_name}"
        evidence_items = db.query(Evidence).filter(Evidence.case_id == case.id).all()
        content = f"COMPREHENSIVE EVIDENCE INDEX\nCASE: {case.case_number}\n\nTotal Evidence Records: {len(evidence_items)}\n"
        for i, ev in enumerate(evidence_items, 1):
            content += f"Item {i}: {ev.original_filename or 'File'} | SHA-256: {ev.sha256} | Status: {ev.validation_status}\n"
    else:
        title = f"Formal Grievance Notice to GRO — {case.merchant_name}"
        content = generate_grievance_notice_text(case, dossier, custom_notes)

    # Compile PDF artifact
    pdf_bytes = compile_pdf_document(title, content)
    pdf_filename = f"{doc_id}_{document_type}.pdf"
    storage_key, sha256, size = storage.save_file(io.BytesIO(pdf_bytes), pdf_filename, case.id)

    log_event(
        db,
        case_id=case.id,
        event_type="document_generated",
        actor="system",
        payload={
            "document_id": doc_id,
            "type": document_type,
            "title": title,
            "storage_key": storage_key,
            "sha256": sha256,
        },
    )

    db.commit()

    return {
        "document_id": doc_id,
        "case_id": case.id,
        "case_number": case.case_number,
        "document_type": document_type,
        "title": title,
        "content": content,
        "storage_key": storage_key,
        "sha256": sha256,
        "status": "DRAFTED_AND_READY",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

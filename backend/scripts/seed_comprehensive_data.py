"""Comprehensive Database Seeder for NyayaBot.

Populates high-fidelity, statutory consumer dispute dossiers, multi-agent negotiation
sessions, evidence files, HITL approval queues, statutory escalations, and tamper-evident audit logs.
"""

from __future__ import annotations

import hashlib
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.auth import hash_password
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import (
    Action,
    Approval,
    AuditEvent,
    Case,
    Conversation,
    Dossier,
    Escalation,
    Evidence,
    Message,
    Transaction,
    User,
)


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed or retrieve Operator and Demo Users
        users = []
        for email, name in [
            ("operator@ps30.internal", "Lead Dispute Officer"),
            ("demo@garuda.ai", "Piyush Consumer"),
        ]:
            u = db.query(User).filter(User.email == email).first()
            if not u:
                u = User(
                    email=email,
                    hashed_password=hash_password("Password123!"),
                    full_name=name,
                    auth_provider="local",
                    is_active=True,
                )
                db.add(u)
                db.flush()
            users.append(u)

        primary_user = users[0]
        user_ids = [u.id for u in users]

        print(f"[Seed] Users ready: {[u.email for u in users]}")

        # 2. Realistic Dispute Dossiers Data
        dossier_definitions = [
            {
                "case_number": "CASE-2026-001",
                "merchant_name": "CloudStream Entertainment India Ltd",
                "merchant_website": "https://cloudstream.example.in",
                "dispute_type": "subscription_cancellation",
                "status": "active",
                "requested_amount": 2499.00,
                "currency": "INR",
                "requested_resolution": "Full refund of ₹2,499 and permanent revocation of recurring mandate",
                "accept_store_credit": False,
                "description": (
                    "Consumer submitted cancellation request 14 days prior to billing cycle. "
                    "Merchant concealed cancel button behind 6 multi-step dark pattern surveys "
                    "and proceeded with unauthorized annual recurring debit."
                ),
                "created_days_ago": 3,
                "transaction": {
                    "amount": 2499.00,
                    "order_reference": "ORD-CS-984218-IN",
                    "payment_method": "Credit Card (HDFC Visa)",
                    "description": "Annual Premium Streaming Auto-Renewal",
                },
                "evidence": [
                    {
                        "filename": "cancellation_confirmation_email.pdf",
                        "content": b"%PDF-1.4 Mock cancellation email confirmation timestamped 14 days prior",
                        "type": "application/pdf",
                        "status": "valid",
                    },
                    {
                        "filename": "hdfc_bank_debit_alert.txt",
                        "content": b"Alert: Rs 2,499.00 debited from HDFC Bank Card ending 4242 at CLOUDSTREAM on 2026-09-30",
                        "type": "text/plain",
                        "status": "valid",
                    },
                ],
                "conversations": [
                    ("consumer", "I cancelled my subscription 2 weeks ago. Why was my card charged ₹2,499?"),
                    ("merchant", "Thank you for reaching out. As per our Terms of Service Section 4, all subscriptions renew automatically and fees are strictly non-refundable."),
                    ("agent", "Under Section 2(47) of the Consumer Protection Act, 2019 and CCPA 2023 Guidelines on Dark Patterns (Annexure I(5): Subscription Trap), refusing cancellation after written notice is an unlawful trade practice. We demand immediate reversal of ₹2,499."),
                    ("merchant", "We can offer you 3 months of extended streaming credits as a courtesy, but our system cannot process a cash refund."),
                ],
                "actions": [
                    {
                        "action_type": "send_formal_notice",
                        "status": "approved",
                        "payload": {
                            "recipient": "grievance.officer@cloudstream.example.in",
                            "statutory_ref": "CPA 2019 Section 2(47) & CCPA 2023 Dark Patterns",
                            "deadline_days": 15,
                        },
                        "approval_decision": "approved",
                        "approval_notes": "Authorized by consumer. Full refund demanded.",
                    }
                ],
                "escalations": [
                    {
                        "channel": "grievance_officer",
                        "reference": "GRO-CS-2026-4412",
                        "status": "submitted",
                        "details": {"officer_email": "grievance.officer@cloudstream.example.in", "statutory_sla_days": 15},
                    }
                ],
            },
            {
                "case_number": "CASE-2026-002",
                "merchant_name": "QuickRide Mobility Services",
                "merchant_website": "https://quickride.mobility.in",
                "dispute_type": "unauthorized_charge",
                "status": "awaiting_approval",
                "requested_amount": 1850.00,
                "currency": "INR",
                "requested_resolution": "Full refund of ₹1,850 to original UPI handle",
                "accept_store_credit": False,
                "description": (
                    "Cab driver unilaterally cancelled trip after 500 meters due to vehicle AC failure. "
                    "Merchant platform algorithm marked trip as completed and deducted ₹1,850 surge fare."
                ),
                "created_days_ago": 2,
                "transaction": {
                    "amount": 1850.00,
                    "order_reference": "QR-TRIP-77192",
                    "payment_method": "UPI AutoPay (GooglePay)",
                    "description": "Airport Drop Surge Fare",
                },
                "evidence": [
                    {
                        "filename": "trip_gps_telemetry_receipt.pdf",
                        "content": b"%PDF-1.4 Trip Telemetry showing 0.4 km actual distance traversed",
                        "type": "application/pdf",
                        "status": "valid",
                    }
                ],
                "conversations": [
                    ("consumer", "Driver cancelled the trip right at start. You deducted ₹1,850 from my UPI!"),
                    ("merchant", "We investigated your ride and apologize for the inconvenience. We have credited ₹150 QuickRide promo cash to your in-app wallet."),
                ],
                "actions": [
                    {
                        "action_type": "reject_partial_settlement",
                        "status": "proposed",
                        "payload": {
                            "merchant_offer_inr": 150.0,
                            "restitution_floor_inr": 1480.0,
                            "recommended_counter": "Reject ₹150 wallet coupon and enforce statutory notice for ₹1,850 UPI refund",
                        },
                        "approval_decision": None,
                        "approval_notes": None,
                    }
                ],
                "escalations": [],
            },
            {
                "case_number": "CASE-2026-003",
                "merchant_name": "ElectroMart India Online Retail",
                "merchant_website": "https://electromart.shop.in",
                "dispute_type": "defective_product",
                "status": "escalated",
                "requested_amount": 18999.00,
                "currency": "INR",
                "requested_resolution": "Full refund of ₹18,999 or replacement with brand-new sealed unit",
                "accept_store_credit": False,
                "description": (
                    "Dell 27-inch 4K IPS Monitor delivered with cracked internal LCD panel. "
                    "Merchant refused replacement claiming 'customer physical damage' despite "
                    "delivery-agent unboxing video timestamped within 10 minutes of handover."
                ),
                "created_days_ago": 7,
                "transaction": {
                    "amount": 18999.00,
                    "order_reference": "EM-ORD-499120",
                    "payment_method": "Debit Card (ICICI)",
                    "description": "Dell 4K IPS UltraSharp Monitor",
                },
                "evidence": [
                    {
                        "filename": "unboxing_delivery_video_screenshot.png",
                        "content": b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR Unboxing verification frame",
                        "type": "image/png",
                        "status": "valid",
                    },
                    {
                        "filename": "tax_invoice_EM_499120.pdf",
                        "content": b"%PDF-1.4 GST Tax Invoice ElectroMart Rs 18,999.00",
                        "type": "application/pdf",
                        "status": "valid",
                    },
                ],
                "conversations": [
                    ("consumer", "Monitor delivered broken inside sealed carton. Delivery person was present."),
                    ("merchant", "Damage reported after delivery completion. ElectroMart policy does not cover post-delivery physical damage."),
                    ("agent", "Under Section 84 of the Consumer Protection Act, 2019 (Product Liability of Seller), delivery of intrinsically damaged goods establishes strict seller liability. An unboxing inspection audit has been recorded."),
                ],
                "actions": [
                    {
                        "action_type": "compile_edaakhil_litigation_bundle",
                        "status": "approved",
                        "payload": {
                            "commission": "District Consumer Disputes Redressal Commission",
                            "pecuniary_jurisdiction": "Under ₹50 Lakhs (Zero Court Fee Tier)",
                            "claim_amount_inr": 18999.0,
                        },
                        "approval_decision": "approved",
                        "approval_notes": "Escalate to District Consumer Forum via e-Daakhil",
                    }
                ],
                "escalations": [
                    {
                        "channel": "e_jagriti",
                        "reference": "EJAG-DL-2026-09182",
                        "status": "submitted",
                        "details": {"forum": "New Delhi District Consumer Forum", "complaint_type": "Product Liability"},
                    },
                    {
                        "channel": "nch",
                        "reference": "NCH-INGRAM-554192",
                        "status": "acknowledged",
                        "details": {"convergence_partner": "ElectroMart India", "sla_days": 45},
                    },
                ],
            },
            {
                "case_number": "CASE-2026-004",
                "merchant_name": "FlyAir Global Airlines",
                "merchant_website": "https://flyair.aero",
                "dispute_type": "refund_request",
                "status": "resolved",
                "requested_amount": 8450.00,
                "currency": "INR",
                "requested_resolution": "Full refund of ₹8,450 without cancellation forfeiture",
                "accept_store_credit": False,
                "description": (
                    "Flight SG-441 cancelled by airline 6 hours prior to departure due to crew scheduling. "
                    "Airline withheld ₹3,500 cancellation fee contrary to DGCA Civil Aviation Requirements."
                ),
                "created_days_ago": 12,
                "transaction": {
                    "amount": 8450.00,
                    "order_reference": "PNR-W8X92K",
                    "payment_method": "NetBanking (SBI)",
                    "description": "Roundtrip Flight BOM-DEL",
                },
                "evidence": [
                    {
                        "filename": "airline_cancellation_sms.txt",
                        "content": b"FlyAir: Flight SG-441 on 2026-09-20 cancelled due to operational reasons.",
                        "type": "text/plain",
                        "status": "valid",
                    }
                ],
                "conversations": [
                    ("agent", "As per DGCA CAR Section 3, Series M, Part IV, cancellation initiated by the airline entitles passenger to full 100% refund without deduction."),
                    ("merchant", "Our legal team has reviewed the DGCA statutory reference. Refund of ₹8,450 has been approved and processed back to source account."),
                ],
                "actions": [
                    {
                        "action_type": "mark_case_resolved",
                        "status": "approved",
                        "payload": {"refund_received_inr": 8450.0, "settlement_type": "full_cash_restitution"},
                        "approval_decision": "approved",
                        "approval_notes": "Full amount credited back to consumer account.",
                    }
                ],
                "escalations": [
                    {
                        "channel": "bank_dispute",
                        "reference": "CHARGEBACK-SBI-2026-781",
                        "status": "resolved",
                        "details": {"merchant_accepted": True, "reversal_confirmed": True},
                    }
                ],
            },
            {
                "case_number": "CASE-2026-005",
                "merchant_name": "FitPulse Health & Fitness Clubs",
                "merchant_website": "https://fitpulse.fitness.in",
                "dispute_type": "dark_pattern",
                "status": "intake_pending",
                "requested_amount": 4500.00,
                "currency": "INR",
                "requested_resolution": "Immediate revocation of recurring mandate and refund of ₹4,500",
                "accept_store_credit": False,
                "description": (
                    "FitPulse processed monthly recurring debit without sending mandatory 24-hour pre-debit "
                    "notification required under RBI April 21, 2026 E-Mandate master directions."
                ),
                "created_days_ago": 1,
                "transaction": {
                    "amount": 4500.00,
                    "order_reference": "FP-SUB-MANDATE-8821",
                    "payment_method": "UPI AutoPay (NPCI)",
                    "description": "Monthly Gym Membership Debit",
                },
                "evidence": [],
                "conversations": [],
                "actions": [
                    {
                        "action_type": "rbi_mandate_revocation",
                        "status": "proposed",
                        "payload": {
                            "rule": "RBI 2026 E-Mandate Circular Sec 4(b)",
                            "violation": "No pre-debit SMS/notification 24 hours in advance",
                            "action": "Trigger issuing bank UPI mandate revoke deep-link",
                        },
                        "approval_decision": None,
                        "approval_notes": None,
                    }
                ],
                "escalations": [],
            },
        ]

        # 3. Create all records in DB for each case definition
        now = datetime.now(timezone.utc)
        for user in users:
            for d in dossier_definitions:
                case_num = f"{d['case_number']}-{user.id[:4]}"
                # Check if case exists
                existing_case = db.query(Case).filter(Case.case_number == case_num).first()
                if existing_case:
                    continue

                case_created = now - timedelta(days=d["created_days_ago"])
                case = Case(
                    user_id=user.id,
                    case_number=case_num,
                    merchant_name=d["merchant_name"],
                    merchant_legal_entity_verified=True,
                    merchant_website=d["merchant_website"],
                    jurisdiction="IN",
                    dispute_type=d["dispute_type"],
                    status=d["status"],
                    requested_amount=d["requested_amount"],
                    currency=d["currency"],
                    requested_resolution=d["requested_resolution"],
                    accept_store_credit=d["accept_store_credit"],
                    description=d["description"],
                    created_at=case_created,
                    updated_at=case_created + timedelta(hours=2),
                )
                db.add(case)
                db.flush()

                # Dossier
                dossier = Dossier(
                    case_id=case.id,
                    verified_facts=json.dumps({
                        "merchant": d["merchant_name"],
                        "claim_amount": d["requested_amount"],
                        "statutory_jurisdiction": "Consumer Protection Act, 2019",
                    }),
                    resolution_constraints=json.dumps({
                        "requested_resolution": d["requested_resolution"],
                        "accept_store_credit": d["accept_store_credit"],
                        "minimum_floor": round(d["requested_amount"] * 0.8, 2),
                    }),
                    missing_fields=json.dumps([]),
                    evidence_summary=f"Automated intake verified {len(d['evidence'])} annexures.",
                    created_at=case_created,
                    updated_at=case_created + timedelta(hours=1),
                )
                db.add(dossier)

                # Transaction
                tx_data = d["transaction"]
                tx = Transaction(
                    case_id=case.id,
                    amount=tx_data["amount"],
                    currency="INR",
                    transaction_at=case_created - timedelta(days=2),
                    order_reference=tx_data["order_reference"],
                    payment_method=tx_data["payment_method"],
                    description=tx_data["description"],
                    created_at=case_created,
                )
                db.add(tx)

                # Evidence files
                for ev in d["evidence"]:
                    sha256 = hashlib.sha256(ev["content"]).hexdigest()
                    storage_key = f"{case.id}/{uuid.uuid4().hex}_{ev['filename']}"
                    storage_path = Path(settings.EVIDENCE_STORAGE_PATH) / storage_key
                    storage_path.parent.mkdir(parents=True, exist_ok=True)
                    storage_path.write_bytes(ev["content"])

                    evidence_record = Evidence(
                        case_id=case.id,
                        storage_key=storage_key,
                        sha256=sha256,
                        original_filename=ev["filename"],
                        content_type=ev["type"],
                        file_size_bytes=len(ev["content"]),
                        validation_status=ev["status"],
                        ocr_extracted_text=f"OCR extracted text for {ev['filename']}. Verified statutory proof.",
                        metadata_json=json.dumps({"sha256": sha256, "encrypted": True}),
                        created_at=case_created + timedelta(minutes=10),
                    )
                    db.add(evidence_record)

                # Conversations & Messages
                if d["conversations"]:
                    conv = Conversation(
                        case_id=case.id,
                        channel="web_chat",
                        status="active" if d["status"] in ("active", "awaiting_approval") else "completed",
                        started_at=case_created + timedelta(minutes=20),
                    )
                    db.add(conv)
                    db.flush()

                    for idx, (sender, text) in enumerate(d["conversations"]):
                        msg = Message(
                            conversation_id=conv.id,
                            sender=sender,
                            content=text,
                            occurred_at=case_created + timedelta(minutes=20 + idx * 5),
                            trusted_as_instruction=(sender == "agent"),
                        )
                        db.add(msg)

                # Actions & Approvals
                for act in d["actions"]:
                    action = Action(
                        case_id=case.id,
                        action_type=act["action_type"],
                        status=act["status"],
                        payload=json.dumps(act["payload"]),
                        result=json.dumps({"executed": act["status"] == "approved"}),
                        created_at=case_created + timedelta(hours=1),
                        executed_at=case_created + timedelta(hours=1, minutes=30) if act["status"] == "approved" else None,
                    )
                    db.add(action)
                    db.flush()

                    approval = Approval(
                        action_id=action.id,
                        decision=act["approval_decision"],
                        decided_at=case_created + timedelta(hours=1, minutes=20) if act["approval_decision"] else None,
                        decided_by=user.id if act["approval_decision"] else None,
                        notes=act["approval_notes"],
                        created_at=case_created + timedelta(hours=1),
                    )
                    db.add(approval)

                # Escalations
                for esc in d["escalations"]:
                    escalation = Escalation(
                        case_id=case.id,
                        channel=esc["channel"],
                        reference=esc["reference"],
                        status=esc["status"],
                        details=json.dumps(esc["details"]),
                        submitted_at=case_created + timedelta(hours=3),
                        created_at=case_created + timedelta(hours=3),
                    )
                    db.add(escalation)

                # Audit Events
                events = [
                    ("dossier_created", "user", {"merchant": d["merchant_name"], "amount": d["requested_amount"]}),
                    ("evidence_uploaded", "user", {"count": len(d["evidence"])}),
                    ("statutory_audit", "system", {"statutes": ["CPA 2019", "CCPA 2023 Dark Patterns"]}),
                ]
                if d["actions"]:
                    events.append(("action_proposed", "agent", {"action": d["actions"][0]["action_type"]}))
                if d["status"] == "resolved":
                    events.append(("case_resolved", "system", {"refund_settled": d["requested_amount"]}))

                for idx, (etype, actor, payload) in enumerate(events):
                    audit = AuditEvent(
                        case_id=case.id,
                        event_type=etype,
                        actor=actor,
                        payload=json.dumps(payload),
                        timestamp=case_created + timedelta(minutes=5 + idx * 15),
                    )
                    db.add(audit)

                print(f"[Seed] Created case: {case_num} ({d['merchant_name']}) - {d['status']}")

        db.commit()
        print("[Seed] Successfully populated all realistic consumer dispute dossiers and operational data!")

    except Exception as e:
        db.rollback()
        print(f"[Seed Error] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()

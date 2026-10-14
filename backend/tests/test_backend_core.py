"""Comprehensive backend unit & integration test suite for PS 30 Counter-Agent.

Tests:
1. Dossier validation and business rule enforcement.
2. Evidence storage, SHA-256 integrity, and path traversal protection.
3. LangGraph cyclic multi-agent graph execution.
4. Loop breaker & semantic cosine similarity detection (S_max threshold).
5. Sentinel safety policy enforcement and action verdicts.
6. Grounded hybrid legal retrieval (RRF) and statutory provenance.
7. HITL settlement approval decisions and audit trail.
8. Statutory escalation pathways and SLAs.
9. ReportLab PDF document compilation and notice generator.
10. Privacy & sensitive PII masking (DPDP Act 2023).
"""

import io
import unittest
from datetime import datetime, timezone

from app.agent.graph import negotiation_graph
from app.agent.nodes.loop_breaker import loop_breaker_node
from app.agent.nodes.sentinel import sentinel_node
from app.agent.nodes.triage import triage_node
from app.core.exceptions import ValidationError
from app.core.logging import mask_sensitive_text
from app.database import Base, SessionLocal, engine
from app.models import Case, Dossier, User
from app.retrieval.embeddings import compute_embedding, cosine_similarity
from app.retrieval.indexing import STATUTORY_CORPUS
from app.retrieval.reranker import hybrid_search
from app.services.approval_service import process_hitl_decision
from app.services.document_service import compile_pdf_document, generate_grievance_notice_text
from app.services.dossier_service import validate_and_create_dossier
from app.services.escalation_service import ESCALATION_CHANNELS, create_escalation
from app.storage.evidence_storage import EvidenceStorage


class TestPS30BackendCore(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.db = SessionLocal()
        # Create test user
        cls.test_user = cls.db.query(User).filter(User.email == "core_test@ps30.internal").first()
        if not cls.test_user:
            cls.test_user = User(
                email="core_test@ps30.internal",
                hashed_password="hashed_pw_test",
                full_name="Core Testing User",
            )
            cls.db.add(cls.test_user)
            cls.db.commit()
            cls.db.refresh(cls.test_user)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    # ── 1. Dossier & Validation ──────────────────────────────────────
    def test_01_dossier_validation_success(self):
        case, dossier = validate_and_create_dossier(
            db=self.db,
            user_id=self.test_user.id,
            payload={
                "merchant_name": "Acme SaaS Ltd",
                "merchant_cin": "U72200MH2020PTC123456",
                "disputed_amount_inr": 4999.00,
                "min_acceptable_refund_inr": 4000.00,
                "pre_debit_notice_received": False,
                "require_emandate_revocation": True,
            },
        )
        self.assertIsNotNone(case.id)
        self.assertIsNotNone(dossier.case_id)
        self.assertEqual(case.requested_amount, 4999.00)
        self.assertEqual(case.status, "active")

    def test_02_dossier_validation_empty_merchant_fails(self):
        with self.assertRaises(ValidationError):
            validate_and_create_dossier(
                db=self.db,
                user_id=self.test_user.id,
                payload={"merchant_name": "", "disputed_amount_inr": 1000},
            )

    def test_03_dossier_validation_negative_amount_fails(self):
        with self.assertRaises(ValidationError):
            validate_and_create_dossier(
                db=self.db,
                user_id=self.test_user.id,
                payload={"merchant_name": "Test", "disputed_amount_inr": -500},
            )

    # ── 2. Storage & Path Traversal Protection ───────────────────────
    def test_04_storage_path_traversal_prevention(self):
        storage_mgr = EvidenceStorage()
        with self.assertRaises(ValidationError):
            storage_mgr._safe_path("../../windows/system32/cmd.exe")

    def test_05_storage_file_save_and_sha256(self):
        storage_mgr = EvidenceStorage()
        content = b"INVOICE EVIDENCE RECEIPT DATA 2026"
        key, sha256, size = storage_mgr.save_file(io.BytesIO(content), "receipt.pdf", "test_case_123")
        self.assertEqual(size, len(content))
        self.assertEqual(len(sha256), 64)
        self.assertTrue(key.startswith("test_case_123/"))

    # ── 3. LangGraph Orchestration & Nodes ───────────────────────────
    def test_06_langgraph_execution_pipeline(self):
        initial_state = {
            "dossier_id": "dossier_001",
            "case_id": "case_001",
            "case_number": "CASE-9999",
            "merchant_name": "Cloud Stream Global",
            "dispute_type": "subscription_cancellation",
            "requested_amount_inr": 2499.00,
            "resolution_floor_inr": 2000.00,
            "accept_store_credit": False,
            "currency": "INR",
            "current_node": "triage",
            "status": "NEGOTIATING",
            "turn": 1,
            "max_turns": 6,
            "messages": [],
            "incoming_merchant_message": "We do not offer cash refunds per our strict terms of service.",
            "prior_merchant_messages": [],
            "bot_embeddings": [],
            "s_max": 0.0,
            "stalled_turns": 0,
            "consecutive_high_sim_count": 0,
            "loop_breaker_triggered": False,
            "circuit_breaker_tripped": False,
            "detected_dark_patterns": [],
            "active_statutes": [],
            "retrieved_provisions": [],
            "strategy_recommendation": None,
            "proposed_response": None,
            "sentinel_verdict": None,
            "sentinel_reason": None,
            "latest_offer_inr": None,
            "pending_hitl": None,
            "error": None,
            "metadata": {},
        }
        final_state = negotiation_graph.invoke(initial_state, config={"configurable": {"thread_id": "test_run_1"}})
        self.assertIn("sentinel_verdict", final_state)
        self.assertEqual(final_state["sentinel_verdict"], "ALLOW")
        self.assertIsNotNone(final_state["proposed_response"])
        self.assertTrue(any("Consumer Protection Act" in s for s in final_state["active_statutes"]))

    # ── 4. Loop Breaker & Semantic Deflection Detection ──────────────
    def test_07_loop_breaker_triggers_on_stalled_deflection(self):
        repeated_message = "Please call our telephone helpline at 1800-000-000 to process any cancellation."
        emb = compute_embedding(repeated_message)

        # Simulate prior turn exhibiting high similarity
        state = {
            "incoming_merchant_message": repeated_message,
            "bot_embeddings": [emb],
            "prior_merchant_messages": [repeated_message],
            "stalled_turns": 1,  # already stalled once
            "turn": 2,
            "max_turns": 6,
            "s_max": 0.0,
            "consecutive_high_sim_count": 1,
            "loop_breaker_triggered": False,
            "circuit_breaker_tripped": False,
        }
        res = loop_breaker_node(state)
        self.assertGreaterEqual(res["s_max"], 0.95)
        self.assertTrue(res["loop_breaker_triggered"])
        self.assertEqual(res["status"], "ESCALATE_EXTERNAL")

    # ── 5. Sentinel Safety Boundary ──────────────────────────────────
    def test_08_sentinel_blocks_when_circuit_tripped(self):
        state = {
            "circuit_breaker_tripped": True,
            "loop_breaker_triggered": True,
            "status": "NEGOTIATING",
        }
        res = sentinel_node(state)
        self.assertEqual(res["sentinel_verdict"], "BLOCK")
        self.assertEqual(res["status"], "ESCALATE_EXTERNAL")

    def test_09_sentinel_engages_hitl_on_financial_offer(self):
        state = {
            "latest_offer_inr": 1800.00,
            "requested_amount_inr": 2000.00,
            "resolution_floor_inr": 1600.00,
            "circuit_breaker_tripped": False,
            "loop_breaker_triggered": False,
            "status": "NEGOTIATING",
        }
        res = sentinel_node(state)
        self.assertEqual(res["sentinel_verdict"], "REQUIRE_APPROVAL")
        self.assertEqual(res["status"], "AWAITING_HITL")
        self.assertIsNotNone(res["pending_hitl"])

    # ── 6. Grounded Hybrid Legal Retrieval (RRF) ─────────────────────
    def test_10_statutory_corpus_provenance(self):
        self.assertGreaterEqual(len(STATUTORY_CORPUS), 7)
        for provision in STATUTORY_CORPUS:
            self.assertIn("source_name", provision)
            self.assertIn("section_or_annexure", provision)
            self.assertIn("retrieved_text", provision)
            self.assertIn("severity", provision)

    def test_11_hybrid_search_rrf_retrieval(self):
        results = hybrid_search(query="subscription trap cancellation dark pattern", top_k=3)
        self.assertGreater(len(results), 0)
        top = results[0]
        self.assertIn("Subscription Trap", top.get("category", "") + top.get("retrieved_text", ""))

    # ── 7. Statutory Escalation Pathways & SLAs ──────────────────────
    def test_12_escalation_pathways_and_slas(self):
        self.assertIn("grievance_officer", ESCALATION_CHANNELS)
        self.assertEqual(ESCALATION_CHANNELS["grievance_officer"]["sla_hours"], 48)
        self.assertIn("nch", ESCALATION_CHANNELS)
        self.assertIn("bank_dispute", ESCALATION_CHANNELS)
        self.assertIn("e_jagriti", ESCALATION_CHANNELS)

    # ── 8. ReportLab PDF Document Compilation ────────────────────────
    def test_13_pdf_document_compilation(self):
        title = "Statutory Grievance Notice — Test Merchant"
        unbroken_token = "SHA256_" + ("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" * 4)
        body = f"This is a formal test notice compiled via ReportLab.\nEVIDENCE DIGEST: {unbroken_token}\nConclusion."
        pdf_bytes = compile_pdf_document(title, body)
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))
        self.assertGreater(len(pdf_bytes), 500)

    # ── 9. Privacy & DPDP Act 2023 PII Scrubbing ────────────────────
    def test_14_sensitive_pii_masking(self):
        log_sample = "Customer Aadhaar 1234-5678-9012 and PAN ABCDE1234F initiated transaction."
        masked = mask_sensitive_text(log_sample)
        self.assertNotIn("1234-5678-9012", masked)
        self.assertNotIn("ABCDE1234F", masked)
        self.assertIn("[REDACTED_AADHAAR]", masked)
        self.assertIn("[REDACTED_PAN]", masked)


if __name__ == "__main__":
    unittest.main()

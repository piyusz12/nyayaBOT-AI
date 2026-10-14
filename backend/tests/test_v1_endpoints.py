"""Unit and integration tests for PS 30 Counter-Agent backend endpoints."""

import unittest
from starlette.testclient import TestClient
from app.main import app


class TestPS30Endpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Register a test operator
        reg_resp = cls.client.post("/api/auth/register", json={
            "email": "test-operator@ps30.internal",
            "password": "SecurePassword123!",
            "full_name": "Test Officer",
        })
        # Login to get bearer token
        login_resp = cls.client.post("/api/auth/login", data={
            "username": "test-operator@ps30.internal",
            "password": "SecurePassword123!",
        })
        if login_resp.status_code == 200:
            token = login_resp.json()["access_token"]
            cls.headers = {"Authorization": f"Bearer {token}"}
        else:
            cls.headers = {}

    def test_01_health_check(self):
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "ok")

    def test_02_legal_research_search(self):
        resp = self.client.get("/api/v1/legal-research")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreater(data["total"], 0)
        self.assertTrue(any("2019" in r["source_name"] for r in data["results"]))

    def test_03_legal_research_query_filter(self):
        resp = self.client.get("/api/v1/legal-research?q=dark")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreater(data["total"], 0)

    def test_04_create_dossier(self):
        resp = self.client.post("/api/v1/dossiers", json={
            "merchant_name": "Test Subscription Corp",
            "disputed_amount_inr": 3500.00,
            "currency": "INR",
            "dispute_type": "subscription_cancellation",
            "description": "Refusal to cancel annual recurring debit",
            "pre_debit_notice_received": False,
            "require_emandate_revocation": True,
        }, headers=self.headers)
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertIn("dossier_id", data)
        self.assertIn("case_number", data)
        self.assertEqual(data["merchant_name"], "Test Subscription Corp")
        TestPS30Endpoints.created_dossier_id = data["dossier_id"]

    def test_05_start_negotiation_session(self):
        dossier_id = getattr(TestPS30Endpoints, "created_dossier_id", None)
        self.assertIsNotNone(dossier_id)
        resp = self.client.post(f"/api/v1/sessions/{dossier_id}/start", headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("session_id", data)
        self.assertEqual(data["status"], "NEGOTIATING")
        TestPS30Endpoints.created_session_id = data["session_id"]

    def test_06_hitl_approval_decision(self):
        session_id = getattr(TestPS30Endpoints, "created_session_id", None)
        self.assertIsNotNone(session_id)

        # 1. Premature submission while session is still NEGOTIATING must return 409 Conflict
        premature_resp = self.client.post(f"/api/v1/sessions/{session_id}/hitl", json={
            "decision": "approved",
            "notes": "Premature attempt",
        }, headers=self.headers)
        self.assertEqual(premature_resp.status_code, 409)

        # 2. Advance session to AWAITING_HITL with pending offer
        from app.services.session_service import ACTIVE_SESSIONS
        ACTIVE_SESSIONS[session_id]["status"] = "AWAITING_HITL"
        ACTIVE_SESSIONS[session_id]["latest_offer_inr"] = 2975.00
        ACTIVE_SESSIONS[session_id]["pending_hitl"] = {
            "session_id": session_id,
            "status": "AWAITING_APPROVAL",
            "offer_amount_inr": 2975.00,
            "requested_amount_inr": 3500.00,
        }

        # 3. Valid HITL decision
        resp = self.client.post(f"/api/v1/sessions/{session_id}/hitl", json={
            "decision": "approved",
            "notes": "Accepted under supervisor sign-off",
        }, headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["decision"], "approved")
        self.assertEqual(data["new_session_status"], "RESOLVED")

        # 4. Duplicate/replay submission on resolved session must return 409 Conflict
        replay_resp = self.client.post(f"/api/v1/sessions/{session_id}/hitl", json={
            "decision": "approved",
        }, headers=self.headers)
        self.assertEqual(replay_resp.status_code, 409)

    def test_07_document_generation(self):
        dossier_id = getattr(TestPS30Endpoints, "created_dossier_id", None)
        self.assertIsNotNone(dossier_id)
        resp = self.client.post("/api/v1/documents/generate", json={
            "case_id": dossier_id,
            "document_type": "grievance_notice",
        }, headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("content", data)
        self.assertIn("Grievance Redressal Officer", data["content"])

    def test_08_approval_action_decide_and_duplicate_rejection(self):
        from app.database import SessionLocal
        from app.models import Action

        dossier_id = getattr(TestPS30Endpoints, "created_dossier_id", None)
        self.assertIsNotNone(dossier_id)

        # 1. Create a proposed action directly in DB
        db = SessionLocal()
        try:
            action = Action(
                case_id=dossier_id,
                action_type="settlement_offer_decision",
                status="proposed",
                payload='{"offer_amount_inr": 2500.0}',
            )
            db.add(action)
            db.commit()
            db.refresh(action)
            action_id = action.id
        finally:
            db.close()

        # 2. Decide the proposed action
        resp = self.client.post(
            f"/api/v1/approvals/{action_id}/decide",
            json={"decision": "approved", "notes": "Approved in test_08"},
            headers=self.headers,
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["action_id"], action_id)
        self.assertEqual(data["decision"], "approved")

        # 3. Duplicate decision on already decided action must return 409 Conflict
        dup_resp = self.client.post(
            f"/api/v1/approvals/{action_id}/decide",
            json={"decision": "approved", "notes": "Duplicate attempt"},
            headers=self.headers,
        )
        self.assertEqual(dup_resp.status_code, 409)

    def test_09_bot_turn_endpoint(self):
        resp = self.client.post("/api/v1/sessions/bot-turn", json={
            "merchant_message": "Our strict policy states subscription charges are final and non-refundable.",
            "merchant_name": "CloudStream",
            "requested_amount_inr": 2499.0,
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("response_text", data)
        self.assertIn("detected_dark_patterns", data)
        self.assertIn("statutory_citations", data)
        self.assertIn("model_used", data)
        self.assertTrue(len(data["response_text"]) > 20)


if __name__ == "__main__":
    unittest.main()


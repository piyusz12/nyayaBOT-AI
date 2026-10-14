# PS 30 Counter-Agent Backend ⚖️🤖

> **Modular, Secure, Production-Oriented Backend for AI-Powered Consumer Dispute Resolution & Statutory Escalation**

The **PS 30 Counter-Agent** backend provides autonomous multi-agent negotiation, grounded legal retrieval (CPA 2019 / CCPA 2023), real-time Server-Sent Events (SSE) telemetry, cryptographic evidence verification, Sentinel policy enforcement, Human-in-the-Loop (HITL) settlement gates, and statutory escalation management.

---

## 🏛️ Modular Repository Structure

```text
backend/
├── app/
│   ├── main.py                  # FastAPI entry point, lifespan, & exception handlers
│   ├── config.py                # Pydantic Settings configuration
│   ├── dependencies.py          # Common dependency injections (DB, auth)
│   ├── database.py              # SQLAlchemy engine & session factory
│   ├── models.py                # 12 ORM models (Case, Dossier, Evidence, Action, Checkpoint...)
│   ├── schemas.py               # Pydantic validation schemas
│   ├── api/
│   │   ├── router.py            # Central v1 API router
│   │   └── v1/
│   │       ├── routes_health.py      # Liveness & database connectivity
│   │       ├── routes_dossiers.py    # Multi-step intake validation & dossiers
│   │       ├── routes_evidence.py    # 50MB secure upload & OCR retrieval
│   │       ├── routes_sessions.py    # SSE streaming, HITL decisions, & Killswitch
│   │       ├── routes_approvals.py   # Human approval action management
│   │       ├── routes_legal.py       # Grounded statutory search
│   │       ├── routes_escalations.py # Multi-channel statutory escalations
│   │       ├── routes_documents.py   # ReportLab PDF & complaint generator
│   │       └── routes_audit.py       # Tamper-evident audit log
│   ├── core/
│   │   ├── security.py          # JWT tokens & bcrypt password hashing
│   │   ├── exceptions.py        # Domain exceptions (SentinelViolation, etc.)
│   │   ├── logging.py           # Structured logging with DPDP PII scrubbing
│   │   └── lifecycle.py         # Startup / shutdown lifecycle hooks
│   ├── agent/
│   │   ├── state.py             # DisputeAgentState TypedDict
│   │   ├── graph.py             # Compiled LangGraph StateGraph with checkpointing
│   │   ├── supervisor.py        # Conditional transition router
│   │   └── nodes/
│   │       ├── loop_breaker.py        # Cosine similarity S_max(t) loop breaker
│   │       ├── triage.py              # Message triage & dark pattern classifier
│   │       ├── legal_retrieval.py     # Grounded statutory retrieval
│   │       ├── strategy.py            # Posture selection & financial haircut evaluation
│   │       ├── response_generation.py # Statutory counter-response generation
│   │       └── sentinel.py            # Mandatory Sentinel policy boundary (ALLOW/BLOCK/HITL)
│   ├── browser/
│   │   ├── pool_manager.py      # Isolated browser contexts & domain whitelist
│   │   ├── session_worker.py    # Autonomous merchant interaction worker
│   │   ├── network_capture.py   # Sanitized HTTP/WebSocket interaction recorder
│   │   └── evidence_capture.py  # DOM snapshot & screenshot hashing
│   ├── retrieval/
│   │   ├── indexing.py          # Verified statutory corpus (CPA 2019, CCPA 2023, RBI)
│   │   ├── embeddings.py        # Normalized L2 vector embeddings & cosine similarity
│   │   ├── keyword_search.py    # Lexical token matching
│   │   ├── vector_search.py     # Cosine similarity semantic search
│   │   └── reranker.py          # Reciprocal Rank Fusion (RRF) hybrid search
│   ├── services/
│   │   ├── dossier_service.py   # Intake validation & fact serialization
│   │   ├── evidence_service.py  # File storage, SHA-256 calculation & OCR
│   │   ├── session_service.py   # SSE streaming, checkpoint persistence, & agent loop
│   │   ├── approval_service.py  # Consequential decision gate & duplicate protection
│   │   ├── retrieval_service.py # Unified legal corpus search
│   │   ├── escalation_service.py# Multi-channel statutory escalation state machine
│   │   └── document_service.py  # ReportLab PDF & formal draft generation
│   ├── workers/
│   │   ├── evidence_tasks.py    # Background OCR and integrity verification
│   │   ├── document_tasks.py    # Background PDF compilation
│   │   └── escalation_tasks.py  # Background statutory SLA countdown tracking
│   └── storage/
│       └── evidence_storage.py  # Path-traversal protected private storage
├── tests/
│   ├── test_v1_endpoints.py     # End-to-end API integration tests
│   └── test_backend_core.py     # Core unit tests (LangGraph, Sentinel, Storage, RAG)
├── pytest.ini
├── requirements.txt
└── .env.example
```

---

## 🚀 Key Modules & Capabilities

1. **Multi-Agent Orchestration (LangGraph)**:
   - StateGraph compiled with `MemorySaver` and durable database checkpointing.
   - 6 core stages: `loop_breaker` -> `triage` -> `legal_retrieval` -> `strategy` -> `response_generation` -> `sentinel`.
   - Bounded execution with recursion limits and maximum turn budgets.

2. **Loop Breaker & Circuit Breaker**:
   - Computes $S_{\max}(t)$ against previous corporate responses using cosine similarity of normalized 128-dimensional embeddings.
   - Trips when $S_{\max} \ge 0.95$ (direct identical deflection) or two consecutive turns exhibit $S_{\max} \ge 0.88$.
   - Automatically halts circular negotiations and routes to external statutory escalation.

3. **Sentinel Safety Boundary**:
   - Mandatory security gate inspecting proposed actions against user resolution floors, permissions, and policy rules.
   - Supported verdicts: `ALLOW`, `BLOCK`, `REQUIRE_APPROVAL`, `REQUIRE_REVIEW`.

4. **Hybrid Legal Retrieval (RAG & RRF)**:
   - Grounded legal corpus covering CPA 2019, CCPA 2023 Dark Pattern Guidelines (Annexure I), RBI E-Mandate Directions, and E-Commerce Rules 2020.
   - Combines lexical token matching with semantic vector similarity via Reciprocal Rank Fusion ($k=60$).

5. **Human-in-the-Loop (HITL) Settlement Center**:
   - Consequential financial decisions require explicit sign-off via `POST /api/v1/sessions/{session_id}/hitl`.
   - Prevents duplicate execution and records tamper-evident audit logs.

6. **Statutory Escalation State Machine**:
   - Multi-tier escalation pathways:
     - Grievance Redressal Officer (GRO) - 48-hr statutory SLA
     - National Consumer Helpline (NCH - 1915)
     - Bank E-Mandate Chargeback Dispute (RBI Ombudsman)
     - e-Jagriti / e-Daakhil Consumer Commission Filing
   - Emergency Killswitch: `POST /api/v1/sessions/{session_id}/killswitch`.

7. **Legal Document Generator**:
   - Generates formal legal notices, chronological statements of facts, evidence index tables, and consumer complaint drafts.
   - Compiles downloadable PDFs via ReportLab with verifiable SHA-256 hashes.

8. **Security & DPDP Act 2023 Compliance**:
   - Automatic sensitive PII scrubbing (masks Aadhaar, PAN, and card numbers from application logs).
   - Path-traversal protection and 50MB file size limit.
   - Zero storage of biometric credentials or signing keys.

---

## 🛠️ Setup & Execution

### 1. Virtual Environment & Dependencies
```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Run FastAPI Application
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Interactive API documentation: `http://127.0.0.1:8000/docs`

### 4. Run Test Suite
```bash
# Pytest (21 tests across core units and API integration)
pytest tests/
```

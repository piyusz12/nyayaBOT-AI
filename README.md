# PS 30 Counter-Agent ⚖️🤖
> **AI-Powered Consumer Dispute Resolution, Multi-Agent Negotiation & Statutory Escalation Platform**

PS 30 Counter-Agent empowers consumers and dispute officers to create verified dispute dossiers, upload evidence with OCR, monitor real-time multi-agent merchant negotiations, identify potential dark patterns, enforce Human-in-the-Loop (HITL) settlement gates, and prepare statutory escalation bundles under the **Consumer Protection Act, 2019** and **CCPA Dark Pattern Guidelines, 2023**.

---

## 🚀 Key Modules & Capabilities

- **Executive Command Dashboard (`/`)**: Real-time KPI cards (dossiers, active negotiations, pending approvals, escalations, resolved outcomes), 6-stage workflow pipeline ribbon, and live audit feed.
- **Dispute Dossiers Registry (`/cases`)**: Filterable, searchable, and sortable case portfolio with instant status triage.
- **Multi-Step Dossier Intake (`/cases/new`)**: 4-step verified intake covering merchant CIN, order IDs, pre-debit notice checks, multi-file evidence upload, and strict resolution floors.
- **Dossier Details & Evidence Vault (`/cases/[id]`)**: Full case workspace with tabs for Overview, Evidence ledger with SHA-256 provenance and OCR text viewer, Grounded Legal Analysis, and Audit Timeline.
- **Flagship Live AI Negotiation Console (`/negotiations`)**:
  - **Left Panel**: Target case context, resolution constraints, active statutes, and detected dark patterns.
  - **Center Panel**: Real-time streaming conversation transcript distinguishing merchant messages, autonomous agent counter-arguments, system events, and HITL settlement prompts.
  - **Right Panel**: 6-node agent execution monitor (`Triage & Loop Detection`, `Legal Retrieval`, `Dialogue Generation`, `Sentinel Audit`, `Human Approval Gate`, `Escalation Override`) with live $S_{max}(t)$ similarity score and stalled turns telemetry.
  - **Live Controls**: Start session, emergency Killswitch override, and SSE streaming connection (`/api/v1/sessions/{session_id}/stream`).
- **Human-in-the-Loop (HITL) Approval Center (`/approvals`)**: Strict governance interface displaying merchant offers vs original claim, haircut calculations, explicit Approve / Reject controls, and audit notes.
- **Legal Research & Dark-Pattern Index (`/legal-research`)**: Grounded statutory provisions from CPA 2019, CCPA 2023 Dark Pattern prohibitions (Annexure I), and RBI e-mandate circulars with keyword search and severity filtering.
- **Escalation Control Center (`/escalations`)**: Multi-level escalation pathways for Company Grievance Redressal Officers (GRO), National Consumer Helpline (NCH 1915), Banking E-Mandate disputes, and e-Jagriti consumer commission filing.
- **Document Generator (`/documents`)**: Generates formal legal notices, chronological event records, evidence indexes, and e-Daakhil consumer complaint drafts with print and copy functionality.
- **Tamper-Evident Audit Trail (`/audit`)**: Append-only log with actor filters (AI Agent, Operator, System) and JSON payload inspector.
- **Platform Governance & Settings (`/settings`)**: Live backend health monitor, API URL configuration, and multi-agent loop detection threshold controls.

---

## 🏗️ Architecture & Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router with Turbopack)
- **Language**: TypeScript
- **Styling**: Curated Legal-Tech Design System (Vanilla CSS tokens, responsive charcoal/navy surfaces, custom scrollbars, and accessible controls)
- **Icons**: Lucide React
- **Streaming**: Native Server-Sent Events (SSE) Client with auto-reconnection and cleanup
- **State & Auth**: React Context with Bearer JWT tokens and One-Click Operator Demo Mode

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Database / ORM**: SQLite / SQLAlchemy 2.0
- **Document & OCR Engine**: PyMuPDF, Pillow, PyTesseract
- **Authentication**: JWT (OAuth2 Password flow / Jose) & Passlib (Bcrypt)
- **Streaming**: FastAPI `StreamingResponse` emitting `text/event-stream` for live agent execution telemetry

---

## 📁 Repository Structure

```
ps-30-counter-agent/
├── backend/
│   ├── app/
│   │   ├── agent/          # DisputeAgentState schema & LangGraph typing
│   │   ├── routers/        # FastAPI endpoints:
│   │   │   ├── auth.py         # Registration & OAuth2 token endpoints
│   │   │   ├── cases.py        # Case CRUD, dossier & unified timeline
│   │   │   ├── sessions.py     # Live SSE streaming, HITL gate & killswitch
│   │   │   ├── evidence.py     # Multi-file upload, SHA-256 hash & OCR
│   │   │   ├── actions.py      # Action proposals & approval records
│   │   │   ├── escalations.py  # Statutory escalation channels
│   │   │   ├── transactions.py # Financial order dispute tracking
│   │   │   └── audit.py        # Append-only audit logs
│   │   ├── services/       # Core case, evidence, and audit logging services
│   │   ├── config.py       # Pydantic settings & storage paths
│   │   ├── database.py     # SQLAlchemy engine & session maker
│   │   ├── main.py         # FastAPI application entry point
│   │   ├── models.py       # 12 database models & relationships
│   │   └── schemas.py      # Typed Pydantic request/response schemas
│   ├── tests/              # Backend integration tests (unittest / TestClient)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Executive Command Dashboard
│   │   │   ├── cases/              # Dossier registry & workspace
│   │   │   ├── negotiations/       # Live AI Negotiation Console (Flagship)
│   │   │   ├── approvals/          # HITL Settlement Gate Center
│   │   │   ├── evidence/           # Centralized Evidence Vault
│   │   │   ├── legal-research/     # Grounded CPA 2019 / CCPA legal index
│   │   │   ├── escalations/        # GRO, NCH, Banking & e-Jagriti pathways
│   │   │   ├── documents/          # Formal legal draft generator
│   │   │   ├── audit/              # Tamper-evident audit trail
│   │   │   ├── settings/           # Platform governance & thresholds
│   │   │   └── login/              # Operator sign in & 1-click demo access
│   │   ├── components/         # Persistent Sidebar & Top Header
│   │   └── lib/                # Typed API client, SSE subscriber & Auth context
│   ├── tests/                  # Frontend unit & integration test suite
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
└── README.md
```

---

## 🛠️ Quickstart Guide

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment (Windows PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1
# (macOS/Linux: source venv/bin/activate)

# Install dependencies
pip install -r requirements.txt

# Run FastAPI server
uvicorn app.main:app --reload --port 8000
```

Backend interactive documentation will be accessible at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

### 2. Frontend Setup

```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
Click **"⚡ One-Click Operator Sign In (Demo Mode)"** on the login page for instant frictionless access.

---

## 🧪 Running Tests

### Frontend Integration Tests
```bash
cd frontend
npm test
```
Executes Node.js test runner verifying dossier fact serialization, financial floor calculations, evidence 50MB constraints, 6-node agent graph states, $S_{max}$ loop detection triggers, HITL approval payloads, and privacy protections.

### Backend Endpoint Tests
```bash
cd backend
.\venv\Scripts\python.exe -m unittest tests/test_v1_endpoints.py
```
Tests health check, legal provision retrieval, dossier creation, session initialization, HITL decision submissions, and formal document compilation with the FastAPI `TestClient`.

---

## 🔒 Security & Privacy Governance
In accordance with the Digital Personal Data Protection (DPDP) Act 2023:
- Sensitive identification credentials (such as Aadhaar or bank passwords) are **never** requested, logged, or persisted.
- Consequential financial concessions and external escalations **always** require explicit human confirmation.
- Evidence files are verified with cryptographic SHA-256 digests.

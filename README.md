# nyayaBOT-AI ⚖️🤖

**nyayaBOT-AI** is an AI-powered Consumer Dispute & Grievance Resolution platform designed to streamline, automate, and accelerate the handling of customer complaints, evidence analysis, and case resolutions.

---

## 🚀 Key Features

- **Automated Case Intake & Tracking**: Create and track dispute cases with status workflows (New, In Review, Evidence Pending, Escalated, Resolved).
- **Evidence Ingestion & OCR Processing**: Upload documents, invoices, receipts, and emails (PDF/Images) with automatic text extraction using PyMuPDF and Tesseract OCR.
- **Smart Dispute Analysis & Triage**: Automatic category classification, priority rating, and financial transaction linking.
- **Human-in-the-Loop Approval & Actions**: Recommended resolution actions with approval workflows and audit trails.
- **Escalation Management**: Seamlessly escalate complex cases to senior officers or specialized dispute panels.
- **Comprehensive Audit Log**: Tamper-evident logging of all actions, updates, and reviews for legal and compliance readiness.
- **Modern Dashboard UI**: Built with Next.js (App Router), React, and styled with accessible modern UI components.

---

## 🏗️ Architecture & Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Vanilla CSS & CSS Modules
- **State & Auth**: React Context (`AuthContext`) with JWT handling

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Database / ORM**: SQLite / SQLAlchemy 2.0
- **Document & OCR Engine**: PyMuPDF, Pillow, PyTesseract
- **Authentication**: JWT (OAuth2 Password flow / Jose) & Passlib (Bcrypt)

---

## 📁 Repository Structure

```
nyayaBOT-AI/
├── backend/
│   ├── app/
│   │   ├── agent/          # Agent state and resolution logic
│   │   ├── routers/        # API endpoints (auth, cases, evidence, etc.)
│   │   ├── services/       # Core business & evidence processing services
│   │   ├── auth.py         # JWT and password utilities
│   │   ├── config.py       # Pydantic settings
│   │   ├── database.py     # SQLAlchemy DB engine and session
│   │   ├── main.py         # FastAPI application entry point
│   │   ├── models.py       # Database schema models
│   │   └── schemas.py      # Pydantic request/response schemas
│   ├── evidence_store/     # Local store for uploaded case evidence files
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── app/            # Next.js App Router pages (cases, escalations, audit, etc.)
│   │   ├── components/     # Header, Sidebar, and UI components
│   │   └── lib/            # API client and auth context
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
└── README.md
```

---

## 🛠️ Quickstart Guide

### 1. Prerequisites
- **Node.js** (v18+ or v20+)
- **Python** (3.10+)
- *(Optional)* **Tesseract OCR** installed on system path for scanned document OCR.

---

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Configure environment
copy .env.example .env

# Run FastAPI dev server
uvicorn app.main:app --reload --port 8000
```

The backend API documentation will be available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

### 3. Frontend Setup

```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install dependencies
npm install

# (Optional) Configure environment
copy .env.example .env.local

# Run Next.js dev server
npm run dev
```

Open `http://localhost:3000` in your browser to view the application.

---

## 🔒 Security & Privacy Note
Never commit sensitive credentials, API keys, or production databases. Use `.env` files for configuration.

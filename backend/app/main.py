"""Garuda AI — FastAPI application entry point.

Run with:
    cd backend
    uvicorn app.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import auth, cases, evidence, transactions, actions, escalations, audit, sessions

# ── Create tables ────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="PS 30 Counter-Agent — Consumer Dispute Resolution Platform",
    version=settings.APP_VERSION,
    description="Consumer dispute resolution and counter-agent escalation platform",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(evidence.router)
app.include_router(transactions.router)
app.include_router(actions.router)
app.include_router(escalations.router)
app.include_router(audit.router)
app.include_router(sessions.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": settings.APP_NAME, "version": settings.APP_VERSION}

"""PS 30 Counter-Agent — FastAPI application entry point.

Run with:
    cd backend
    uvicorn app.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_v1_router
from app.config import settings
from app.core.exceptions import (
    AuthorizationError,
    DuplicateSubmissionError,
    NotFoundError,
    PS30BaseException,
    SentinelViolationError,
    ValidationError,
)
from app.core.lifecycle import on_shutdown, on_startup
from app.database import Base, engine
from app.routers import actions, audit, auth, cases, escalations, evidence, sessions, transactions


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for startup and shutdown execution."""
    on_startup()
    yield
    on_shutdown()


# ── Create tables ────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="PS 30 Counter-Agent — Consumer Dispute Resolution Platform",
    version=settings.APP_VERSION,
    description="Consumer dispute resolution and counter-agent escalation platform",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Exception Handlers ───────────────────────────────────────────────
@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": exc.message, "details": exc.details})


@app.exception_handler(AuthorizationError)
async def auth_error_handler(request: Request, exc: AuthorizationError):
    return JSONResponse(status_code=403, content={"detail": exc.message, "details": exc.details})


@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=422, content={"detail": exc.message, "details": exc.details})


@app.exception_handler(SentinelViolationError)
async def sentinel_error_handler(request: Request, exc: SentinelViolationError):
    return JSONResponse(status_code=400, content={"detail": exc.message, "details": exc.details})


@app.exception_handler(DuplicateSubmissionError)
async def duplicate_error_handler(request: Request, exc: DuplicateSubmissionError):
    return JSONResponse(status_code=409, content={"detail": exc.message, "details": exc.details})


# ── Routers ──────────────────────────────────────────────────────────
# 1. API v1 Router (Primary standard namespace)
app.include_router(api_v1_router)

# 2. Existing Routers (for seamless backward compatibility with existing endpoints)
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

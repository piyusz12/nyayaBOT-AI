"""Central v1 API router for PS 30 Counter-Agent."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes_health import router as health_router
from app.api.v1.routes_dossiers import router as dossiers_router
from app.api.v1.routes_evidence import router as evidence_router
from app.api.v1.routes_sessions import router as sessions_router
from app.api.v1.routes_approvals import router as approvals_router
from app.api.v1.routes_legal import router as legal_router
from app.api.v1.routes_escalations import router as escalations_router
from app.api.v1.routes_documents import router as documents_router
from app.api.v1.routes_audit import router as audit_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(health_router)
api_v1_router.include_router(dossiers_router)
api_v1_router.include_router(evidence_router)
api_v1_router.include_router(sessions_router)
api_v1_router.include_router(approvals_router)
api_v1_router.include_router(legal_router)
api_v1_router.include_router(escalations_router)
api_v1_router.include_router(documents_router)
api_v1_router.include_router(audit_router)

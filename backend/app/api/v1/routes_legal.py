"""Legal research and dark pattern querying routes."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services.retrieval_service import query_legal_corpus

router = APIRouter(tags=["v1-legal"])


class LegalSearchPayload(BaseModel):
    query: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    top_k: int = 10


@router.get("/legal-research")
def search_legal_research_get(
    q: Optional[str] = Query(None, description="Search query"),
    category: Optional[str] = Query(None, description="Legal category filter"),
    severity: Optional[str] = Query(None, description="Severity level"),
    top_k: int = Query(10, ge=1, le=50),
):
    """Retrieve indexed statutory provisions and dark pattern classifications via GET query params."""
    return query_legal_corpus(query=q, category=category, severity=severity, top_k=top_k)


@router.post("/legal/search")
def search_legal_research_post(payload: LegalSearchPayload):
    """Search indexed legal provisions via POST body."""
    return query_legal_corpus(
        query=payload.query,
        category=payload.category,
        severity=payload.severity,
        top_k=payload.top_k,
    )

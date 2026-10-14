"""Health and diagnostic status routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db

router = APIRouter(tags=["v1-health"])


@router.get("/health")
def get_v1_health(db: Session = Depends(get_db)):
    """Liveness and readiness health checks with database connectivity test."""
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "status": "ok" if db_ok else "degraded",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "database_connected": db_ok,
        "environment": "development" if settings.DEBUG else "production",
    }


@router.get("/health/models")
def get_local_models_status():
    """Diagnostic endpoint reporting local AI model availability and Ollama status."""
    from app.agent.local_llm import (
        check_ollama_available,
        get_available_local_models,
        get_loaded_models,
        DEFAULT_LOCAL_MODEL,
    )

    online = check_ollama_available()
    models = get_available_local_models() if online else []
    loaded = get_loaded_models() if online else []

    return {
        "ollama_online": online,
        "default_model": DEFAULT_LOCAL_MODEL,
        "active_engine": f"Local AI ({DEFAULT_LOCAL_MODEL})" if online else "Deterministic Statutory Engine",
        "total_local_models": len(models),
        "installed_models": models,
        "loaded_in_memory": loaded,
        "is_model_warm": len(loaded) > 0,
        "recommended_for_legal_counter_agent": "llama3.1:latest" if any("llama3.1" in m["name"] for m in models) else DEFAULT_LOCAL_MODEL,
    }

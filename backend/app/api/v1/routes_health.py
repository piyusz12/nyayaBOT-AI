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

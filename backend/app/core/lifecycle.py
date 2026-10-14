"""Application lifecycle event handlers (startup / shutdown)."""

from __future__ import annotations

import os
from sqlalchemy import text
from app.config import settings
from app.core.logging import logger
from app.database import engine, Base


def on_startup() -> None:
    """Execute startup checks and directory preparations."""
    logger.info("Initializing PS 30 Counter-Agent backend...")

    # Ensure evidence store directory exists
    os.makedirs(settings.EVIDENCE_STORAGE_PATH, exist_ok=True)
    logger.info("Evidence storage verified at: %s", settings.EVIDENCE_STORAGE_PATH)

    # Verify database connection
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connectivity verified.")
    except Exception as exc:
        logger.error("Database connection check failed: %s", exc)
        raise exc

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema initialized successfully.")


def on_shutdown() -> None:
    """Execute graceful shutdown cleanup."""
    logger.info("Shutting down PS 30 Counter-Agent backend...")
    engine.dispose()
    logger.info("Database connection pool closed.")

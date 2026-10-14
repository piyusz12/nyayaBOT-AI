"""Application configuration using pydantic-settings."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration for the Garuda AI backend."""

    # ── Application ──────────────────────────────────────────────────
    APP_NAME: str = "Garuda AI — Consumer Dispute Platform"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # ── Database ─────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./garuda.db"

    # ── Evidence Storage ─────────────────────────────────────────────
    EVIDENCE_STORAGE_PATH: str = str(
        Path(__file__).resolve().parent.parent / "evidence_store"
    )

    # ── Auth (placeholder — swapped for real provider in production) ─
    SECRET_KEY: str = "garuda-dev-secret-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours for dev

    # ── OCR ──────────────────────────────────────────────────────────
    TESSERACT_CMD: str | None = None  # auto-detect if None

    # ── CORS (dev) ───────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure evidence directory exists
os.makedirs(settings.EVIDENCE_STORAGE_PATH, exist_ok=True)

"""FastAPI dependency injection utilities."""

from __future__ import annotations

from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

__all__ = [
    "get_db",
    "get_current_user",
    "oauth2_scheme",
]

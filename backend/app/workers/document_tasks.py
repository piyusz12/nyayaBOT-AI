"""Background document compilation and PDF rendering tasks."""

from __future__ import annotations

from typing import Any, Dict
from sqlalchemy.orm import Session
from app.services.document_service import generate_document


def compile_document_task(
    db: Session,
    case_id: str,
    document_type: str,
    custom_notes: str | None = None,
) -> Dict[str, Any]:
    """Execute background PDF and legal document compilation."""
    return generate_document(db, case_id=case_id, document_type=document_type, custom_notes=custom_notes)

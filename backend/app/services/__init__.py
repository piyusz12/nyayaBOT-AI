"""Services subsystem for PS 30 Counter-Agent."""

from app.services.audit_service import log_event
from app.services.case_service import create_case, get_case, list_cases, update_case
from app.services.evidence_service import save_evidence, get_evidence_by_id, list_evidence_for_case
from app.services.dossier_service import validate_and_create_dossier
from app.services.approval_service import process_hitl_decision
from app.services.escalation_service import create_escalation
from app.services.document_service import generate_document
from app.services.session_service import get_or_init_session, generate_sse_events, ACTIVE_SESSIONS
from app.services.retrieval_service import query_legal_corpus

__all__ = [
    "log_event",
    "create_case",
    "get_case",
    "list_cases",
    "update_case",
    "save_evidence",
    "get_evidence_by_id",
    "list_evidence_for_case",
    "validate_and_create_dossier",
    "process_hitl_decision",
    "create_escalation",
    "generate_document",
    "get_or_init_session",
    "generate_sse_events",
    "ACTIVE_SESSIONS",
    "query_legal_corpus",
]

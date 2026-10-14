"""Browser automation and evidence capture subsystem."""

from app.browser.pool_manager import pool_manager
from app.browser.network_capture import NetworkCapture
from app.browser.evidence_capture import EvidenceCapture
from app.browser.session_worker import SessionWorker

__all__ = [
    "pool_manager",
    "NetworkCapture",
    "EvidenceCapture",
    "SessionWorker",
]

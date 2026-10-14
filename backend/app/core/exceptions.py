"""Standardized domain exception classes for PS 30 Counter-Agent."""

from __future__ import annotations

from typing import Any, Dict, Optional


class PS30BaseException(Exception):
    """Base exception for all domain errors."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(PS30BaseException):
    """Raised when a requested resource is not found."""
    pass


class AuthorizationError(PS30BaseException):
    """Raised when an operation is unauthorized or tenant boundary is violated."""
    pass


class ValidationError(PS30BaseException):
    """Raised when input validation fails on business rules."""
    pass


class SentinelViolationError(PS30BaseException):
    """Raised when the Sentinel policy engine blocks an action proposal."""
    pass


class LoopDetectionError(PS30BaseException):
    """Raised when merchant deflection loop or circuit breaker is tripped."""
    pass


class InvalidStateTransitionError(PS30BaseException):
    """Raised when an illegal lifecycle state transition is attempted."""
    pass


class DuplicateSubmissionError(PS30BaseException):
    """Raised when a consequential decision has already been executed."""
    pass

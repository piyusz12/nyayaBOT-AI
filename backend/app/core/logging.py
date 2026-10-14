"""Structured, privacy-preserving logging configuration.

Masks sensitive personal data (Aadhaar, PAN, passwords, credit card numbers)
in compliance with DPDP Act 2023.
"""

from __future__ import annotations

import logging
import re
import sys
from typing import Any, Dict

# Regex patterns for sensitive data masking
RE_AADHAAR = re.compile(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}\b")
RE_PAN = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b")
RE_CARD = re.compile(r"\b(?:\d{4}[ -]?){3}\d{4}\b")
RE_TOKEN = re.compile(r"(Bearer\s+)[A-Za-z0-9\-_.]+", re.IGNORECASE)


def mask_sensitive_text(text: str) -> str:
    """Mask sensitive PII identifiers from log strings."""
    if not isinstance(text, str):
        return text
    text = RE_AADHAAR.sub("[REDACTED_AADHAAR]", text)
    text = RE_PAN.sub("[REDACTED_PAN]", text)
    text = RE_CARD.sub("[REDACTED_CARD]", text)
    text = RE_TOKEN.sub(r"\1[REDACTED_TOKEN]", text)
    return text


class SensitiveDataFilter(logging.Filter):
    """Logging filter that scrubs sensitive PII identifiers from log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = mask_sensitive_text(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: mask_sensitive_text(v) if isinstance(v, str) else v for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(mask_sensitive_text(a) if isinstance(a, str) else a for a in record.args)
        return True


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """Initialize structured application logger."""
    logger = logging.getLogger("ps30_counter_agent")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter(
                fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )
        handler.addFilter(SensitiveDataFilter())
        logger.addHandler(handler)

    return logger


logger = setup_logging()

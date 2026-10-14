"""Triage node for analyzing merchant messages and detecting dark patterns."""

from __future__ import annotations

import re
from typing import Any, Dict, List
from app.agent.state import DisputeAgentState


def triage_node(state: DisputeAgentState) -> Dict[str, Any]:
    """Parse incoming merchant message, extract monetary offers, and classify dark patterns."""
    text = state.get("incoming_merchant_message") or ""
    detected_patterns: List[str] = list(state.get("detected_dark_patterns") or [])

    # Pattern check: Subscription Trap (demanding phone call or hiding cancel)
    if re.search(r"\b(call us|call our support|phone|helpline|cannot cancel online|terms require phone)\b", text, re.IGNORECASE):
        pat = "CCPA Annexure 1(5): Subscription Trap (Forced phone call to cancel)"
        if pat not in detected_patterns:
            detected_patterns.append(pat)

    # Pattern check: Forced retention / Interface interference
    if re.search(r"\b(non-refundable|cannot refund|strict policy|final sale|no refund under any condition)\b", text, re.IGNORECASE):
        pat = "CPA Sec 2(47): Unfair Trade Practice (Categorical refund refusal)"
        if pat not in detected_patterns:
            detected_patterns.append(pat)

    # Pattern check: Drip pricing / hidden charge
    if re.search(r"\b(processing fee|convenience fee|cancellation fee|maintenance surcharge)\b", text, re.IGNORECASE):
        pat = "CCPA Annexure 1(8): Drip Pricing (Unilateral deduction fee)"
        if pat not in detected_patterns:
            detected_patterns.append(pat)

    # Extract monetary settlement offer if merchant proposed an amount
    offer_match = re.search(r"(?:refund|settle|credit|offer|pay)\s+(?:of\s+)?(?:INR|Rs\.?|₹)?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)", text, re.IGNORECASE)
    extracted_offer = None
    if offer_match:
        try:
            amt_str = offer_match.group(1).replace(",", "")
            extracted_offer = float(amt_str)
        except ValueError:
            extracted_offer = None

    updates: Dict[str, Any] = {
        "current_node": "triage_loop_detector",
        "detected_dark_patterns": detected_patterns,
    }

    if extracted_offer is not None and extracted_offer > 0:
        updates["latest_offer_inr"] = extracted_offer

    return updates

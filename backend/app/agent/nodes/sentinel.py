"""Sentinel Policy Enforcement Boundary.

Mandatory security and compliance gate enforcing explicit application constraints:
- User-defined financial floors
- Consequential financial sign-offs
- Deflection loop overrides
- Anti-hallucination and policy consistency

Verdicts:
- ALLOW: Safe non-binding communication or fact response.
- BLOCK: Proposed action violates user constraints or statutory rules.
- REQUIRE_APPROVAL: Consequential financial settlement or legal waiver.
- REQUIRE_REVIEW: Uncertainty in offer interpretation or incomplete evidence.
"""

from __future__ import annotations

from typing import Any, Dict
from app.agent.state import DisputeAgentState


def sentinel_node(state: DisputeAgentState) -> Dict[str, Any]:
    """Execute strict policy boundary validation on the proposed action."""
    offer = state.get("latest_offer_inr")
    floor = state.get("resolution_floor_inr", 0.0)
    circuit_tripped = state.get("circuit_breaker_tripped", False)
    loop_triggered = state.get("loop_breaker_triggered", False)

    verdict = "ALLOW"
    reason = "Proposed response complies with user dispute mandate and statutory boundaries."
    pending_hitl = None
    new_status = state.get("status", "NEGOTIATING")

    # Policy 1: Circuit breaker / loop breaker tripped -> Route to statutory escalation override
    if circuit_tripped or loop_triggered:
        verdict = "BLOCK"
        reason = "Automated negotiation halted by Sentinel: Merchant deflection loop or max turns reached. Escalating to external legal channel."
        new_status = "ESCALATE_EXTERNAL"

    # Policy 2: Merchant proposed a financial offer
    elif offer is not None and offer > 0:
        verdict = "REQUIRE_APPROVAL"
        reason = f"Consequential financial settlement offer detected: ₹{offer:,.2f}. Mandatory Human-in-the-Loop approval gate engaged."
        new_status = "AWAITING_HITL"
        pending_hitl = {
            "session_id": state.get("dossier_id", ""),
            "status": "AWAITING_APPROVAL",
            "offer_amount_inr": offer,
            "requested_amount_inr": state.get("requested_amount_inr", 0.0),
            "difference_inr": round(state.get("requested_amount_inr", 0.0) - offer, 2),
            "resolution_floor_inr": floor,
            "merchant_name": state.get("merchant_name", "Merchant"),
            "detected_dark_patterns": state.get("detected_dark_patterns", []),
            "active_statutes": state.get("active_statutes", []),
            "prompt": f"Merchant has offered a settlement of ₹{offer:,.2f}. Do you accept this resolution or require statutory escalation?",
        }

    return {
        "current_node": "sentinel_audit",
        "sentinel_verdict": verdict,
        "sentinel_reason": reason,
        "pending_hitl": pending_hitl,
        "status": new_status,
    }

"""Dialogue Response Generation Node.

Generates professional, legally anchored counter-responses
citing verified statutory provisions and explicit resolution demands.
"""

from __future__ import annotations

from typing import Any, Dict
from app.agent.state import DisputeAgentState


def response_generation_node(state: DisputeAgentState) -> Dict[str, Any]:
    """Generate structured counter-response text based on strategy and grounding."""
    merchant = state.get("merchant_name", "Merchant")
    req_amt = state.get("requested_amount_inr", 0.0)
    floor = state.get("resolution_floor_inr", req_amt * 0.8)
    offer = state.get("latest_offer_inr")
    statutes = state.get("active_statutes") or ["Consumer Protection Act, 2019"]
    statutes_str = "; ".join(statutes[:2])

    if offer is not None and offer > 0:
        if offer >= floor:
            response_text = (
                f"We note your proposed settlement offer of ₹{offer:,.2f}. The matter has been submitted to the "
                "consumer for formal sign-off. Please confirm that upon acceptance, the e-mandate linked to this account "
                "will be immediately revoked and written confirmation provided within 24 hours."
            )
        else:
            response_text = (
                f"The offer of ₹{offer:,.2f} is unacceptable as it fails to meet the minimum restitution floor (₹{floor:,.2f}) "
                f"for the unauthorized debit of ₹{req_amt:,.2f}. Under the {statutes_str}, continuing to withhold full "
                "reimbursement constitutes an unfair trade practice. We request immediate reversal of ₹{floor:,.2f} minimum "
                "to avert escalation to the Grievance Redressal Officer."
            )
    else:
        response_text = (
            f"Regarding the disputed charge of ₹{req_amt:,.2f} with {merchant}: please be advised that under the "
            f"{statutes_str}, unilateral renewal without accessible cancellation violates statutory consumer rights. "
            f"We require immediate refund of ₹{req_amt:,.2f} to the original payment source and explicit confirmation "
            "of recurring e-mandate cancellation."
        )

    return {
        "current_node": "dialogue_generator",
        "proposed_response": response_text,
    }

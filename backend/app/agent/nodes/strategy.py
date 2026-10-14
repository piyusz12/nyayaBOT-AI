"""Strategy Formulation Node.

Determines counter-agent posture based on merchant stance,
loop similarity score S_max, and user resolution floor.
"""

from __future__ import annotations

from typing import Any, Dict
from app.agent.state import DisputeAgentState


def strategy_node(state: DisputeAgentState) -> Dict[str, Any]:
    """Formulate optimal negotiation strategy based on active state."""
    latest_offer = state.get("latest_offer_inr")
    floor = state.get("resolution_floor_inr", 0.0)
    req_amt = state.get("requested_amount_inr", 0.0)
    s_max = state.get("s_max", 0.0)

    if latest_offer is not None and latest_offer > 0:
        if latest_offer >= floor:
            recommendation = (
                f"Merchant made an offer of ₹{latest_offer:,.2f}, which satisfies the user resolution floor (₹{floor:,.2f}). "
                "Route to Human-in-the-Loop approval gate for final sign-off."
            )
        else:
            recommendation = (
                f"Merchant offered ₹{latest_offer:,.2f}, which is below the user floor (₹{floor:,.2f}). "
                "Reject haircut, counter with statutory floor, and warn of Level 2 GRO escalation."
            )
    elif s_max >= 0.88:
        recommendation = (
            f"Merchant response exhibits high repetition (S_max={s_max:.2f}). Issue final 48-hour statutory warning "
            "citing CCPA Dark Pattern Guidelines before dispatching GRO complaint."
        )
    else:
        recommendation = (
            f"Demand full reversal of ₹{req_amt:,.2f} citing Consumer Protection Act 2019 Sec 2(47) and RBI E-Mandate Directions. "
            "Request written confirmation of mandate revocation."
        )

    return {
        "current_node": "dialogue_generator",
        "strategy_recommendation": recommendation,
    }

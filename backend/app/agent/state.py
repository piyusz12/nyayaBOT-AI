"""DisputeAgentState TypedDict schema for LangGraph cyclic orchestration.

Models state for PS 30 consumer dispute counter-agent.
"""

from __future__ import annotations

from typing import Annotated, Any, Dict, List, Optional, TypedDict
from langgraph.graph.message import add_messages


class DisputeAgentState(TypedDict):
    dossier_id: str
    case_id: str
    merchant_name: str
    dispute_type: str
    requested_amount_inr: float
    currency: str

    # History of messages with reducer
    messages: Annotated[List[Any], add_messages]

    # History of corporate turn embeddings: {e_1, ..., e_{t-1}}
    bot_embeddings: List[List[float]]

    # Classified violations (e.g. "Annexure I(5): Subscription Trap")
    detected_dark_patterns: List[str]

    # Grounded legal statutes (e.g. CPA 2019 Sec 2(47), E-Commerce Rules 2020)
    active_statutes: List[str]

    # Stalled turns counter: increments on S_max >= 0.95 or 2x >= 0.88
    stalled_turns: int
    consecutive_high_sim_count: int

    # Financial settlement offers from merchant
    latest_offer_inr: Optional[float]
    resolution_floor_inr: float

    # Execution status: "NEGOTIATING" | "AWAITING_HITL" | "ESCALATE_EXTERNAL" | "RESOLVED"
    status: str
    error: Optional[str]
    metadata: Dict[str, Any]

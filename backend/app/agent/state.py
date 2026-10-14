"""DisputeAgentState TypedDict schema for LangGraph multi-agent orchestration.

Models comprehensive state for PS 30 consumer dispute counter-agent.
"""

from __future__ import annotations

from typing import Annotated, Any, Dict, List, Optional, TypedDict
from langgraph.graph.message import add_messages


class DisputeAgentState(TypedDict):
    # Identifiers
    dossier_id: str
    case_id: str
    case_number: str
    merchant_name: str
    dispute_type: str
    requested_amount_inr: float
    resolution_floor_inr: float
    accept_store_credit: bool
    currency: str

    # Workflow positioning
    current_node: str
    status: str  # "INITIALIZING" | "NEGOTIATING" | "AWAITING_HITL" | "ESCALATE_EXTERNAL" | "RESOLVED" | "BLOCKED"
    turn: int
    max_turns: int

    # Messages
    messages: Annotated[List[Any], add_messages]
    incoming_merchant_message: Optional[str]
    prior_merchant_messages: List[str]

    # Loop detection & telemetry
    bot_embeddings: List[List[float]]
    s_max: float
    stalled_turns: int
    consecutive_high_sim_count: int
    loop_breaker_triggered: bool
    circuit_breaker_tripped: bool

    # Legal grounding & Dark pattern analysis
    detected_dark_patterns: List[str]
    active_statutes: List[str]
    retrieved_provisions: List[Dict[str, Any]]

    # Strategy & Generation
    strategy_recommendation: Optional[str]
    proposed_response: Optional[str]

    # Sentinel Safety Gate
    sentinel_verdict: Optional[str]  # "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL" | "REQUIRE_REVIEW"
    sentinel_reason: Optional[str]

    # Financial offer & Human-in-the-loop
    latest_offer_inr: Optional[float]
    pending_hitl: Optional[Dict[str, Any]]

    # Execution metadata & error tracking
    error: Optional[str]
    metadata: Dict[str, Any]

"""Supervisor routing logic for LangGraph execution graph."""

from __future__ import annotations

from typing import Literal
from app.agent.state import DisputeAgentState


def route_after_loop_check(state: DisputeAgentState) -> Literal["triage", "escalation_override"]:
    """Route to escalation override if loop breaker is triggered, else continue to triage."""
    if state.get("loop_breaker_triggered", False) or state.get("circuit_breaker_tripped", False):
        return "escalation_override"
    return "triage"


def route_after_sentinel(state: DisputeAgentState) -> Literal["complete", "await_hitl", "escalate"]:
    """Evaluate Sentinel verdict and determine graph conclusion."""
    verdict = state.get("sentinel_verdict", "ALLOW")
    if verdict == "REQUIRE_APPROVAL":
        return "await_hitl"
    elif verdict == "BLOCK" or state.get("status") == "ESCALATE_EXTERNAL":
        return "escalate"
    return "complete"

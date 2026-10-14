"""LangGraph cyclic orchestration graph for PS 30 Counter-Agent."""

from __future__ import annotations

from typing import Any, Dict
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from app.agent.nodes.legal_retrieval import legal_retrieval_node
from app.agent.nodes.loop_breaker import loop_breaker_node
from app.agent.nodes.response_generation import response_generation_node
from app.agent.nodes.sentinel import sentinel_node
from app.agent.nodes.strategy import strategy_node
from app.agent.nodes.triage import triage_node
from app.agent.state import DisputeAgentState
from app.agent.supervisor import route_after_loop_check


def escalation_override_node(state: DisputeAgentState) -> Dict[str, Any]:
    """Fallback node invoked when loop breaker or emergency override is triggered."""
    return {
        "current_node": "escalation_override",
        "status": "ESCALATE_EXTERNAL",
        "proposed_response": (
            "Merchant communication has stalled in repetitive deflection loops. "
            "Automated negotiation is halted and forwarded to statutory escalation pathways."
        ),
    }


def create_negotiation_graph():
    """Build and compile the multi-agent StateGraph with checkpointing."""
    builder = StateGraph(DisputeAgentState)

    # Register nodes
    builder.add_node("loop_breaker", loop_breaker_node)
    builder.add_node("triage", triage_node)
    builder.add_node("legal_retrieval", legal_retrieval_node)
    builder.add_node("strategy", strategy_node)
    builder.add_node("response_generation", response_generation_node)
    builder.add_node("sentinel", sentinel_node)
    builder.add_node("escalation_override", escalation_override_node)

    # Edge flow
    builder.add_edge(START, "loop_breaker")

    builder.add_conditional_edges(
        "loop_breaker",
        route_after_loop_check,
        {
            "triage": "triage",
            "escalation_override": "escalation_override",
        },
    )

    builder.add_edge("triage", "legal_retrieval")
    builder.add_edge("legal_retrieval", "strategy")
    builder.add_edge("strategy", "response_generation")
    builder.add_edge("response_generation", "sentinel")
    builder.add_edge("sentinel", END)
    builder.add_edge("escalation_override", END)

    # Compile with memory checkpointer
    checkpointer = MemorySaver()
    graph = builder.compile(checkpointer=checkpointer)
    return graph


# Singleton compiled graph
negotiation_graph = create_negotiation_graph()

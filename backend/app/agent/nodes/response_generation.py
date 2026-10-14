"""Dialogue Response Generation Node.

Generates professional, legally anchored counter-responses
citing verified statutory provisions and explicit resolution demands.
"""

from __future__ import annotations

from typing import Any, Dict
from app.agent.local_llm import generate_adversarial_counter_response
from app.agent.state import DisputeAgentState


def response_generation_node(state: DisputeAgentState) -> Dict[str, Any]:
    """Generate structured counter-response text using local AI LLM (Llama 3.2 / 3.1)."""
    response_text = generate_adversarial_counter_response(state)

    return {
        "current_node": "dialogue_generator",
        "proposed_response": response_text,
    }

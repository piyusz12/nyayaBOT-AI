"""Loop Breaker & Semantic Deflection Detection Node.

Compares incoming merchant response embeddings against prior responses
using cosine similarity S_max(t).
Trigger rules:
- S_max >= 0.95 (single identical deflection)
- S_max >= 0.88 for 2 consecutive turns (stalled deflection loop)
- Exceeding max turn budget
"""

from __future__ import annotations

from typing import Any, Dict
from app.agent.state import DisputeAgentState
from app.retrieval.embeddings import compute_embedding, cosine_similarity

HIGH_SIMILARITY_THRESHOLD = 0.95
CONSECUTIVE_SIMILARITY_THRESHOLD = 0.88
MAX_STALLED_TURNS_LIMIT = 2


def loop_breaker_node(state: DisputeAgentState) -> Dict[str, Any]:
    """Execute semantic loop detection and deflection risk checks."""
    incoming = state.get("incoming_merchant_message") or ""
    if not incoming:
        return {
            "current_node": "triage_loop_detector",
            "s_max": state.get("s_max", 0.0),
            "stalled_turns": state.get("stalled_turns", 0),
            "loop_breaker_triggered": False,
        }

    # Compute embedding for the new merchant message
    new_emb = compute_embedding(incoming)
    prior_embeddings = state.get("bot_embeddings") or []

    s_max = 0.0
    most_similar_prev = ""
    prior_messages = state.get("prior_merchant_messages") or []

    for i, p_emb in enumerate(prior_embeddings):
        sim = cosine_similarity(new_emb, p_emb)
        if sim > s_max:
            s_max = sim
            if i < len(prior_messages):
                most_similar_prev = prior_messages[i]

    stalled_turns = state.get("stalled_turns", 0)
    consecutive_count = state.get("consecutive_high_sim_count", 0)
    loop_triggered = False

    if s_max >= HIGH_SIMILARITY_THRESHOLD:
        stalled_turns += 1
        consecutive_count += 1
    elif s_max >= CONSECUTIVE_SIMILARITY_THRESHOLD:
        consecutive_count += 1
        if consecutive_count >= 2:
            stalled_turns += 1
    else:
        consecutive_count = 0

    if stalled_turns >= MAX_STALLED_TURNS_LIMIT or state.get("turn", 1) > state.get("max_turns", 6):
        loop_triggered = True

    # Update state history
    updated_embeddings = list(prior_embeddings) + [new_emb]
    updated_messages = list(prior_messages) + [incoming]

    updates: Dict[str, Any] = {
        "current_node": "triage_loop_detector",
        "s_max": round(s_max, 4),
        "stalled_turns": stalled_turns,
        "consecutive_high_sim_count": consecutive_count,
        "bot_embeddings": updated_embeddings,
        "prior_merchant_messages": updated_messages,
        "loop_breaker_triggered": loop_triggered,
    }

    if loop_triggered:
        updates["status"] = "ESCALATE_EXTERNAL"
        updates["circuit_breaker_tripped"] = True
        updates["metadata"] = {
            **state.get("metadata", {}),
            "loop_reason": f"Merchant deflection loop detected: S_max={s_max:.3f}, stalled_turns={stalled_turns}",
            "most_similar_prev": most_similar_prev[:120],
        }

    return updates

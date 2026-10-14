"""Legal Retrieval Node.

Grounds agent arguments in verified statutory provisions from CPA 2019,
CCPA 2023 Dark Pattern Guidelines, and RBI E-Mandate Directions.
"""

from __future__ import annotations

from typing import Any, Dict, List
from app.agent.state import DisputeAgentState
from app.retrieval.reranker import hybrid_search


def legal_retrieval_node(state: DisputeAgentState) -> Dict[str, Any]:
    """Retrieve grounded legal provisions relevant to the active dispute."""
    merchant_msg = state.get("incoming_merchant_message") or ""
    patterns = state.get("detected_dark_patterns") or []
    dispute_type = state.get("dispute_type") or "subscription_cancellation"

    query = f"{dispute_type} {' '.join(patterns)} {merchant_msg}"
    results = hybrid_search(query=query, top_k=3)

    active_statutes: List[str] = list(state.get("active_statutes") or [])
    for res in results:
        stat_label = f"{res['source_name']} - {res['section_or_annexure']}"
        if stat_label not in active_statutes:
            active_statutes.append(stat_label)

    return {
        "current_node": "legal_retriever",
        "active_statutes": active_statutes,
        "retrieved_provisions": results,
    }

"""Hybrid search rank fusion and reranking module.

Combines lexical keyword rankings with vector semantic similarity
using Reciprocal Rank Fusion (RRF).
"""

from __future__ import annotations

from typing import Any, Dict, List
from app.retrieval.keyword_search import lexical_search
from app.retrieval.vector_search import vector_search

RRF_K = 60  # Standard smoothing constant for Reciprocal Rank Fusion


def hybrid_search(
    query: str,
    category: str | None = None,
    severity: str | None = None,
    top_k: int = 10,
    lexical_weight: float = 0.5,
    vector_weight: float = 0.5,
) -> List[Dict[str, Any]]:
    """Execute hybrid search using Reciprocal Rank Fusion over lexical and semantic candidates."""
    if not query:
        # Default lexical filter
        raw_lexical = lexical_search(query, category=category, severity=severity, top_k=top_k)
        return [item for item, _ in raw_lexical]

    lexical_results = lexical_search(query, category=category, severity=severity, top_k=top_k * 2)
    vector_results = vector_search(query, category=category, severity=severity, top_k=top_k * 2)

    fused_scores: Dict[str, float] = {}
    item_map: Dict[str, Dict[str, Any]] = {}

    for rank, (item, score) in enumerate(lexical_results):
        iid = item["id"]
        item_map[iid] = item
        rrf = lexical_weight * (1.0 / (RRF_K + rank + 1))
        fused_scores[iid] = fused_scores.get(iid, 0.0) + rrf

    for rank, (item, score) in enumerate(vector_results):
        iid = item["id"]
        item_map[iid] = item
        rrf = vector_weight * (1.0 / (RRF_K + rank + 1))
        fused_scores[iid] = fused_scores.get(iid, 0.0) + rrf

    sorted_ids = sorted(fused_scores.keys(), key=lambda iid: fused_scores[iid], reverse=True)

    ranked_items: List[Dict[str, Any]] = []
    for iid in sorted_ids[:top_k]:
        item_copy = dict(item_map[iid])
        item_copy["fusion_score"] = round(fused_scores[iid], 6)
        ranked_items.append(item_copy)

    return ranked_items

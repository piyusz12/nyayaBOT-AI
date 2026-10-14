"""Unified Legal and Dark-Pattern Retrieval Service."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from app.retrieval.indexing import STATUTORY_CORPUS
from app.retrieval.reranker import hybrid_search


def query_legal_corpus(
    query: Optional[str] = None,
    category: Optional[str] = None,
    severity: Optional[str] = None,
    top_k: int = 10,
) -> Dict[str, Any]:
    """Search authoritative statutory provisions with hybrid lexical and semantic ranking."""
    results = hybrid_search(
        query=query or "",
        category=category,
        severity=severity,
        top_k=top_k,
    )
    return {
        "total": len(results),
        "query": query,
        "category": category,
        "severity": severity,
        "results": results,
    }

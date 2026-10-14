"""Lexical keyword and token-matching search over legal provisions."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple
from app.retrieval.indexing import STATUTORY_CORPUS


def _tokenize(text: str) -> List[str]:
    """Tokenize and normalize text into lowercase word tokens."""
    return [w.lower() for w in re.findall(r"\w+", text) if len(w) > 2]


def lexical_search(
    query: str,
    category: str | None = None,
    severity: str | None = None,
    top_k: int = 10,
) -> List[Tuple[Dict[str, Any], float]]:
    """Score legal corpus candidates against lexical query tokens.

    Returns:
        List of tuples: (statutory_item, score) sorted descending by relevance.
    """
    query_tokens = set(_tokenize(query))
    if not query_tokens and not category and not severity:
        # Return all filtered items with base score
        results = []
        for item in STATUTORY_CORPUS:
            if category and item.get("category", "").lower() != category.lower():
                continue
            if severity and item.get("severity", "").lower() != severity.lower():
                continue
            results.append((item, 1.0))
        return results[:top_k]

    scored_items: List[Tuple[Dict[str, Any], float]] = []

    for item in STATUTORY_CORPUS:
        # Apply filters
        if category and item.get("category", "").lower() != category.lower():
            continue
        if severity and item.get("severity", "").lower() != severity.lower():
            continue

        item_tokens = set()
        item_tokens.update(_tokenize(item.get("source_name", "")))
        item_tokens.update(_tokenize(item.get("act_or_regulation", "")))
        item_tokens.update(_tokenize(item.get("section_or_annexure", "")))
        item_tokens.update(_tokenize(item.get("category", "")))
        item_tokens.update(_tokenize(item.get("retrieved_text", "")))
        for kw in item.get("keywords", []):
            item_tokens.update(_tokenize(kw))

        if not query_tokens:
            score = 1.0
        else:
            intersection = query_tokens.intersection(item_tokens)
            score = len(intersection) / max(len(query_tokens), 1)

            # Boost exact keyword matches
            query_lower = query.lower()
            for kw in item.get("keywords", []):
                if kw in query_lower:
                    score += 0.5
            if item.get("dark_pattern_code", "").lower() in query_lower:
                score += 1.0

        if score > 0:
            scored_items.append((item, round(score, 4)))

    scored_items.sort(key=lambda x: x[1], reverse=True)
    return scored_items[:top_k]

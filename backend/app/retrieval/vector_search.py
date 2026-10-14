"""Vector semantic search over indexed legal corpus."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple
from app.retrieval.embeddings import compute_embedding, cosine_similarity
from app.retrieval.indexing import STATUTORY_CORPUS

# Pre-compute and cache embeddings for static statutory corpus
_CORPUS_EMBEDDINGS: List[Tuple[Dict[str, Any], List[float]]] = []


def _ensure_corpus_embeddings():
    global _CORPUS_EMBEDDINGS
    if not _CORPUS_EMBEDDINGS:
        for item in STATUTORY_CORPUS:
            combined_text = f"{item['source_name']} {item['category']} {item['retrieved_text']} {' '.join(item.get('keywords', []))}"
            emb = compute_embedding(combined_text)
            _CORPUS_EMBEDDINGS.append((item, emb))


def vector_search(
    query: str,
    category: str | None = None,
    severity: str | None = None,
    top_k: int = 10,
) -> List[Tuple[Dict[str, Any], float]]:
    """Perform semantic cosine similarity search against indexed legal provisions."""
    _ensure_corpus_embeddings()
    if not query:
        return []

    q_emb = compute_embedding(query)
    scored: List[Tuple[Dict[str, Any], float]] = []

    for item, item_emb in _CORPUS_EMBEDDINGS:
        if category and item.get("category", "").lower() != category.lower():
            continue
        if severity and item.get("severity", "").lower() != severity.lower():
            continue

        sim = cosine_similarity(q_emb, item_emb)
        if sim > 0.05:
            scored.append((item, sim))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]

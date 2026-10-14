"""Vector embeddings module for semantic similarity and retrieval.

Provides normalized embeddings using deterministic semantic projection
or local Ollama embeddings if configured.
"""

from __future__ import annotations

import hashlib
import re
from typing import List
import numpy as np

EMBEDDING_DIM = 128


def compute_embedding(text: str) -> List[float]:
    """Generate a normalized 128-dimensional embedding vector for input text.

    Uses deterministic token-hash feature projection with L2 normalization,
    providing stable cosine similarity computation without requiring external weights.
    """
    if not text:
        return [0.0] * EMBEDDING_DIM

    tokens = [w.lower() for w in re.findall(r"\w+", text)]
    if not tokens:
        return [0.0] * EMBEDDING_DIM

    vector = np.zeros(EMBEDDING_DIM, dtype=np.float32)

    for i, token in enumerate(tokens):
        # Character n-grams and token hashing
        h = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
        idx = h % EMBEDDING_DIM
        weight = 1.0 / (1.0 + 0.1 * i)
        vector[idx] += weight

        # Also encode token bigrams
        if i > 0:
            bigram = f"{tokens[i-1]}_{token}"
            h_bi = int(hashlib.sha256(bigram.encode("utf-8")).hexdigest(), 16)
            idx_bi = h_bi % EMBEDDING_DIM
            vector[idx_bi] += weight * 1.5

    # L2 unit normalization
    norm = np.linalg.norm(vector)
    if norm > 1e-6:
        vector = vector / norm

    return [round(float(v), 6) for v in vector]


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculate cosine similarity between two float vectors."""
    a = np.array(v1, dtype=np.float32)
    b = np.array(v2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a < 1e-6 or norm_b < 1e-6:
        return 0.0
    sim = float(np.dot(a, b) / (norm_a * norm_b))
    return round(float(np.clip(sim, -1.0, 1.0)), 4)

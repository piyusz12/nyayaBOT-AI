"""Retrieval and legal knowledge base subsystem."""

from app.retrieval.indexing import STATUTORY_CORPUS
from app.retrieval.embeddings import compute_embedding, cosine_similarity
from app.retrieval.keyword_search import lexical_search
from app.retrieval.vector_search import vector_search
from app.retrieval.reranker import hybrid_search

__all__ = [
    "STATUTORY_CORPUS",
    "compute_embedding",
    "cosine_similarity",
    "lexical_search",
    "vector_search",
    "hybrid_search",
]

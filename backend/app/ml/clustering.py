"""
Clustering primitives for the Discovery Feed.

Groups case embedding vectors into clusters using HDBSCAN (density-based —
we don't know ahead of time how many "emerging signals" exist, so a method
that doesn't require a fixed cluster count is the right fit). Noise points
(label -1) are cases that don't cluster with anything yet and are excluded
from signals.
"""

from typing import List

import numpy as np
from sklearn.cluster import HDBSCAN


def cluster_vectors(vectors: List[List[float]], min_cluster_size: int = 3) -> List[int]:
    """
    Clusters normalized embedding vectors.
    Returns a label per input vector; -1 means "noise" (no cluster).
    """
    if len(vectors) < min_cluster_size:
        return [-1] * len(vectors)

    X = np.array(vectors)
    model = HDBSCAN(min_cluster_size=min_cluster_size, metric="euclidean")
    labels = model.fit_predict(X)
    return labels.tolist()


def group_by_label(items: List[dict], labels: List[int]) -> dict:
    """items[i] belongs to cluster labels[i]. Returns {label: [items]}, excluding noise (-1)."""
    groups: dict = {}
    for item, label in zip(items, labels):
        if label == -1:
            continue
        groups.setdefault(label, []).append(item)
    return groups


def centroid(vectors: List[List[float]]) -> List[float]:
    """Mean vector of a cluster, re-normalized to unit length (cosine space)."""
    X = np.array(vectors)
    c = X.mean(axis=0)
    norm = np.linalg.norm(c)
    return (c / norm).tolist() if norm > 0 else c.tolist()


def cosine_similarities_to_centroid(vectors: List[List[float]]) -> List[float]:
    """Per-vector cosine similarity to the cluster centroid (vectors are unit-normalized,
    so this is just a dot product). Used as `similarity_score` per case in the signal."""
    if not vectors:
        return []
    X = np.array(vectors)
    c = np.array(centroid(vectors))
    return [float(v @ c) for v in X]


def cluster_cohesion(vectors: List[List[float]]) -> float:
    """
    Average pairwise cosine similarity within a cluster (vectors are already
    normalized, so dot product == cosine similarity). Roughly 0-1, higher = tighter.
    """
    if len(vectors) < 2:
        return 1.0
    X = np.array(vectors)
    sims = X @ X.T
    n = len(vectors)
    off_diag_sum = sims.sum() - np.trace(sims)
    count = n * (n - 1)
    return float(off_diag_sum / count) if count else 1.0
"""
Fingerprint-space projection.

Pulls fingerprint vectors (+ de-identified payload) from Qdrant and
projects them to 2D with PCA for the "fingerprint visualization" panel —
cases plotted as points, clustering by clinical similarity, with zero
patient identifiers anywhere on screen or in the underlying vectors.
This is the proof that the representation is irreversible-but-useful,
shown rather than just claimed.
"""

from collections import Counter
from typing import Optional

import numpy as np
from sklearn.decomposition import PCA

from app.db.qdrant_client import scroll_all

MIN_POINTS_FOR_PROJECTION = 3


def _label_for(payload: dict) -> str:
    """Best available clinical label for colouring a point, in priority order."""
    if payload.get("diagnosis_icd"):
        return payload["diagnosis_icd"]
    symptom_names = payload.get("symptom_names") or []
    if symptom_names and symptom_names[0]:
        return symptom_names[0]
    return "unlabelled"


def project_fingerprint_space(hospital_id: Optional[str] = None, limit: int = 300) -> dict:
    points = scroll_all(limit=limit, hospital_id=hospital_id)

    if len(points) < MIN_POINTS_FOR_PROJECTION:
        return {"points": [], "clusters": [], "total": len(points), "explained_variance": []}

    vectors = np.array([p.vector for p in points])
    n_components = 2 if vectors.shape[0] >= 2 else 1
    pca = PCA(n_components=n_components)
    coords = pca.fit_transform(vectors)

    labels = [_label_for(p.payload or {}) for p in points]

    result_points = []
    for p, coord, label in zip(points, coords, labels):
        payload = p.payload or {}
        x = float(coord[0])
        y = float(coord[1]) if n_components == 2 else 0.0
        result_points.append({
            "id": str(p.id),
            "x": x,
            "y": y,
            "label": label,
            "hospital_id": payload.get("hospital_id"),
            "age_range": payload.get("age_range"),
            "outcome": payload.get("outcome"),
        })

    cluster_counts = Counter(labels)
    clusters = [{"label": k, "count": v} for k, v in cluster_counts.most_common()]

    return {
        "points": result_points,
        "clusters": clusters,
        "total": len(points),
        "explained_variance": [float(v) for v in pca.explained_variance_ratio_],
    }
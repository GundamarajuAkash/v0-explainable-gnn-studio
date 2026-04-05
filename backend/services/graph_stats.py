"""
Compute graph statistics from raw node/edge data or a PyG Data object.
Used by the Dataset Overview Card and Imbalance Info Card in the UI.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

import torch
from torch_geometric.data import Data


def _balance_status(ir: float) -> str:
    """
    Determine balance status from imbalance ratio.
    IR < 1.5  -> balanced
    1.5 <= IR < 3 -> imbalanced
    IR >= 3 -> highly_imbalanced
    """
    if ir < 1.5:
        return "balanced"
    elif ir < 3.0:
        return "imbalanced"
    else:
        return "highly_imbalanced"


def compute_graph_stats_from_pyg(data: Data, name: str = "custom") -> dict[str, Any]:
    """
    Compute full summary stats from a PyG Data object.
    """
    n = data.num_nodes
    m = data.num_edges
    num_classes = int(data.y.max().item()) + 1
    num_features = data.num_features

    density = (2 * m) / (n * (n - 1)) if n > 1 else 0
    avg_degree = (2 * m) / n if n > 0 else 0

    class_counts = torch.bincount(data.y, minlength=num_classes).tolist()

    max_count = max(class_counts) if class_counts else 1
    min_count = min(class_counts) if class_counts else 1
    ir = max_count / max(min_count, 1)

    major_class = class_counts.index(max_count)
    minor_class = class_counts.index(min_count)

    dataset_id = name.lower().replace(" ", "-").replace("_", "-")

    return {
        "id": dataset_id,
        "name": name,
        "num_nodes": n,
        "num_edges": m,
        "num_features": num_features,
        "num_classes": num_classes,
        "density": round(density, 6),
        "avg_degree": round(avg_degree, 2),
        "class_counts": [
            {"class_id": f"C{i}", "count": c} for i, c in enumerate(class_counts)
        ],
        "imbalance_ratio": round(ir, 2),
        "major_class": major_class,
        "minor_class": minor_class,
        "balance_status": _balance_status(ir),
        "is_builtin": False,
    }


def compute_graph_stats(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    num_classes: int,
    feature_dim: int,
    name: str = "custom",
) -> dict[str, Any]:
    """
    Given raw node/edge lists (from JSON upload), compute summary statistics.
    """
    n = len(nodes)
    m = len(edges)

    density = (2 * m) / (n * (n - 1)) if n > 1 else 0
    avg_degree = (2 * m) / n if n > 0 else 0

    label_counts = Counter(node.get("label", 0) for node in nodes)
    class_counts_list = [label_counts.get(c, 0) for c in range(num_classes)]

    max_count = max(class_counts_list) if class_counts_list else 1
    min_count = min(class_counts_list) if class_counts_list else 1
    ir = max_count / max(min_count, 1)

    major_class = class_counts_list.index(max_count)
    minor_class = class_counts_list.index(min_count)

    dataset_id = name.lower().replace(" ", "-").replace("_", "-")

    return {
        "id": dataset_id,
        "name": name,
        "num_nodes": n,
        "num_edges": m,
        "num_features": feature_dim,
        "num_classes": num_classes,
        "density": round(density, 6),
        "avg_degree": round(avg_degree, 2),
        "class_counts": [
            {"class_id": f"C{i}", "count": c} for i, c in enumerate(class_counts_list)
        ],
        "imbalance_ratio": round(ir, 2),
        "major_class": major_class,
        "minor_class": minor_class,
        "balance_status": _balance_status(ir),
        "is_builtin": False,
    }

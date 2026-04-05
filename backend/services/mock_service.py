"""
Deterministic mock data generators — Python port of lib/mock-data.ts.
Used when MOCK_MODE=true. All functions use seeded random for reproducibility.
"""

from __future__ import annotations

import math
import random
from typing import Any

# ── Seeded random helper ────────────────────────────────────────────────────

def _seeded_random(seed: int) -> random.Random:
    return random.Random(seed)


def _seed_from_string(s: str) -> int:
    return sum(ord(c) for c in s) * 137 + 7


# ── Constants ───────────────────────────────────────────────────────────────

MODELS = ["GCN", "GAT", "GraphSAGE", "ChebNet", "GIN", "PinSAGE"]
METHODS = ["baseline", "weighted", "focal", "oversample", "undersample", "nodeimport", "svwng"]

BUILTIN_DATASETS: dict[str, dict[str, Any]] = {
    # Planetoid citation networks
    "Cora": {
        "num_nodes": 2708, "num_edges": 10556, "num_features": 1433,
        "num_classes": 7, "density": 0.0029, "avg_degree": 3.9,
        "class_counts": [351, 217, 418, 298, 180, 590, 654],
        "major_class": 6, "minor_class": 4,
        "description": "Citation network of ML papers",
    },
    "CiteSeer": {
        "num_nodes": 3327, "num_edges": 9104, "num_features": 3703,
        "num_classes": 6, "density": 0.0016, "avg_degree": 2.74,
        "class_counts": [701, 596, 668, 590, 265, 507],
        "major_class": 0, "minor_class": 4,
        "description": "Citation network of CS papers",
    },
    "PubMed": {
        "num_nodes": 19717, "num_edges": 88648, "num_features": 500,
        "num_classes": 3, "density": 0.00046, "avg_degree": 4.5,
        "class_counts": [4103, 7459, 8155],
        "major_class": 2, "minor_class": 0,
        "description": "Citation network of diabetes papers",
    },
    # Amazon co-purchase
    "Amazon-Photo": {
        "num_nodes": 7650, "num_edges": 119081, "num_features": 745,
        "num_classes": 8, "density": 0.004, "avg_degree": 31.13,
        "class_counts": [1150, 980, 750, 1200, 890, 620, 1300, 760],
        "major_class": 6, "minor_class": 5,
        "description": "Amazon product co-purchase (Photo)",
    },
    "Amazon-Computers": {
        "num_nodes": 13752, "num_edges": 245861, "num_features": 767,
        "num_classes": 10, "density": 0.0026, "avg_degree": 35.76,
        "class_counts": [1800, 1600, 1100, 2100, 900, 750, 1900, 1300, 1200, 1102],
        "major_class": 3, "minor_class": 5,
        "description": "Amazon product co-purchase (Computers)",
    },
}


# ── Dataset Summary ─────────────────────────────────────────────────────────

def get_builtin_dataset_summary(name: str) -> dict[str, Any]:
    ds = BUILTIN_DATASETS[name]
    cc = ds["class_counts"]
    ir = max(cc) / max(min(cc), 1)
    return {
        "id": name.lower().replace(" ", "-"),
        "name": name,
        "num_nodes": ds["num_nodes"],
        "num_edges": ds["num_edges"],
        "num_features": ds["num_features"],
        "num_classes": ds["num_classes"],
        "density": ds["density"],
        "avg_degree": ds["avg_degree"],
        "class_counts": [{"class_id": f"C{i}", "count": c} for i, c in enumerate(cc)],
        "imbalance_ratio": round(ir, 2),
        "major_class": ds["major_class"],
        "minor_class": ds["minor_class"],
        "is_builtin": True,
    }


# ── Benchmark Results ───────────────────────────────────────────────────────

def generate_benchmark_results(
    dataset_id: str,
    models: list[str],
    methods: list[str],
    num_classes: int = 7,
) -> list[dict[str, Any]]:
    rng = _seeded_random(_seed_from_string(dataset_id))
    results = []

    for model in models:
        for method in methods:
            base = 0.6 + rng.random() * 0.25

            # Per-class metrics
            per_class = []
            for c in range(num_classes):
                class_drop = c * 0.025
                p = min(1, max(0, base + 0.05 - class_drop + (rng.random() - 0.5) * 0.08))
                r = min(1, max(0, base + 0.02 - class_drop * 1.2 + (rng.random() - 0.5) * 0.1))
                f1 = (2 * p * r) / (p + r) if (p + r) > 0 else 0
                spec = min(1, max(0, 0.88 + rng.random() * 0.1 - class_drop * 0.3))
                fpr = 1 - spec
                support = round(200 - c * 22 + rng.random() * 30)
                per_class.append({
                    "class_id": f"C{c}",
                    "precision": round(p, 4),
                    "recall": round(r, 4),
                    "f1": round(f1, 4),
                    "specificity": round(spec, 4),
                    "fpr": round(fpr, 4),
                    "support": support,
                })

            # Confusion matrix
            cm = [[0] * num_classes for _ in range(num_classes)]
            for true_c in range(num_classes):
                total = per_class[true_c]["support"]
                correct = round(total * per_class[true_c]["recall"])
                cm[true_c][true_c] = correct
                remaining = total - correct
                for pred_c in range(num_classes):
                    if pred_c == true_c or remaining <= 0:
                        continue
                    err = min(round(remaining * (0.1 + rng.random() * 0.3)), remaining)
                    cm[true_c][pred_c] = err
                    remaining -= err
                if remaining > 0:
                    other = 1 if true_c == 0 else 0
                    cm[true_c][other] += remaining

            results.append({
                "model": model,
                "method": method,
                "ACC": round(base + rng.random() * 0.1, 4),
                "bACC": round(base - 0.02 + rng.random() * 0.1, 4),
                "MacroF1": round(base - 0.03 + rng.random() * 0.1, 4),
                "ECE": round(0.02 + rng.random() * 0.08, 4),
                "Brier": round(0.1 + rng.random() * 0.15, 4),
                "WorstRecall": round(base - 0.15 + rng.random() * 0.15, 4),
                "GMean": round(base - 0.05 + rng.random() * 0.1, 4),
                "per_class_metrics": per_class,
                "confusion_matrix": cm,
            })

    return results


# ── Training Curves ─────────────────────────────────────────────────────────

def generate_training_curves(
    dataset_id: str,
    model: str,
    method: str,
    epochs: int = 200,
) -> list[dict[str, Any]]:
    rng = _seeded_random(_seed_from_string(f"{dataset_id}_{model}_{method}"))
    curves = []
    for e in range(1, epochs + 1):
        progress = e / epochs
        train_loss = 1.5 * math.exp(-3 * progress) + rng.random() * 0.05
        val_loss = 1.6 * math.exp(-2.8 * progress) + rng.random() * 0.08
        train_acc = min(1, 0.3 + 0.6 * (1 - math.exp(-4 * progress)) + rng.random() * 0.02)
        val_acc = min(1, 0.25 + 0.55 * (1 - math.exp(-3.5 * progress)) + rng.random() * 0.03)
        curves.append({
            "epoch": e,
            "train_loss": round(train_loss, 4),
            "val_loss": round(val_loss, 4),
            "train_acc": round(train_acc, 4),
            "val_acc": round(val_acc, 4),
        })
    return curves


# ── Explainability ──────────��───────────────────────────────────────────────

def generate_explanation(
    dataset_id: str,
    model: str,
    method: str,
    node_id: int,
    num_classes: int = 7,
    num_features: int = 10,
) -> dict[str, Any]:
    rng = _seeded_random(_seed_from_string(f"{dataset_id}_{model}_{method}_{node_id}"))

    true_class = node_id % num_classes
    pred_class = true_class if rng.random() > 0.2 else (true_class + 1) % num_classes
    confidence = round(0.6 + rng.random() * 0.35, 4)

    # Subgraph
    num_neighbors = 4 + int(rng.random() * 6)
    nodes = [{"id": node_id, "label": true_class, "importance": 1.0}]
    for i in range(1, num_neighbors + 1):
        nid = node_id + i * 7 + int(rng.random() * 100)
        nodes.append({
            "id": nid,
            "label": int(rng.random() * num_classes),
            "importance": round(rng.random() * 0.8, 4),
        })
    edges = []
    for n in nodes[1:]:
        edges.append({
            "source": node_id,
            "target": n["id"],
            "weight": round(0.2 + rng.random() * 0.8, 4),
        })
    # Add a few cross-edges
    for i in range(min(3, len(nodes) - 2)):
        edges.append({
            "source": nodes[i + 1]["id"],
            "target": nodes[i + 2]["id"],
            "weight": round(rng.random() * 0.5, 4),
        })

    # Feature importance
    features = []
    for f in range(min(num_features, 10)):
        features.append({
            "feature_name": f"feat_{f}",
            "importance": round(rng.random(), 4),
        })
    features.sort(key=lambda x: x["importance"], reverse=True)

    return {
        "node_id": node_id,
        "predicted_class": pred_class,
        "true_class": true_class,
        "confidence": confidence,
        "subgraph_nodes": nodes,
        "subgraph_edges": edges,
        "feature_importance": features,
        "fidelity": round(0.7 + rng.random() * 0.25, 4),
        "coverage": round(0.6 + rng.random() * 0.3, 4),
    }


def generate_global_explanation(
    dataset_id: str,
    model: str,
    method: str,
    num_classes: int = 7,
    num_samples: int = 50,
) -> dict[str, Any]:
    rng = _seeded_random(_seed_from_string(f"global_{dataset_id}_{model}_{method}"))

    per_class = []
    for c in range(num_classes):
        per_class.append({
            "class_id": f"C{c}",
            "avg_fidelity": round(0.65 + rng.random() * 0.3, 4),
            "avg_coverage": round(0.55 + rng.random() * 0.35, 4),
            "avg_subgraph_size": round(4 + rng.random() * 8, 2),
        })

    stability = []
    for c in range(num_classes):
        stability.append({
            "class_id": f"C{c}",
            "mean_jaccard": round(0.4 + rng.random() * 0.5, 4),
        })

    fids = [pc["avg_fidelity"] for pc in per_class]
    covs = [pc["avg_coverage"] for pc in per_class]

    return {
        "per_class": per_class,
        "stability": stability,
        "overall_fidelity": round(sum(fids) / len(fids), 4),
        "overall_coverage": round(sum(covs) / len(covs), 4),
    }


# ── Balance Preview ─────────────────────────────────────────────────────────

def generate_balance_preview(
    dataset_id: str,
    method: str,
) -> dict[str, Any]:
    ds_name = None
    for name, ds in BUILTIN_DATASETS.items():
        if name.lower().replace(" ", "-") == dataset_id or name == dataset_id:
            ds_name = name
            break

    if ds_name:
        original = BUILTIN_DATASETS[ds_name]["class_counts"]
    else:
        rng = _seeded_random(_seed_from_string(dataset_id))
        original = [round(100 + rng.random() * 500) for _ in range(7)]

    max_count = max(original)
    min_count = min(original)
    original_ir = max_count / max(min_count, 1)

    rng2 = _seeded_random(_seed_from_string(f"{dataset_id}_{method}"))

    if method == "oversample":
        balanced = [max_count for _ in original]
    elif method == "undersample":
        balanced = [min_count for _ in original]
    elif method in ("weighted", "focal", "nodeimport", "svwng"):
        balanced = [round(c + (max_count - c) * (0.3 + rng2.random() * 0.3)) for c in original]
    else:
        balanced = list(original)

    balanced_ir = max(balanced) / max(min(balanced), 1)

    return {
        "method": method,
        "original_counts": [{"class_id": f"C{i}", "count": c} for i, c in enumerate(original)],
        "balanced_counts": [{"class_id": f"C{i}", "count": c} for i, c in enumerate(balanced)],
        "original_ir": round(original_ir, 2),
        "balanced_ir": round(balanced_ir, 2),
        "ir_improvement": round(original_ir - balanced_ir, 2),
    }

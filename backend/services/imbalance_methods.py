"""
Imbalance handling methods for GNN training.
Each function modifies training data / loss function / sampler for the GNN.

Real mode only — requires torch, torch_geometric.
"""

from __future__ import annotations

from typing import Any, Callable

import torch
import torch.nn.functional as F
import numpy as np


# ── Loss Factories ──────────────────────────────────────────────────────────

def get_baseline_loss() -> Callable:
    """Standard cross-entropy with no class balancing."""
    return F.cross_entropy


def get_weighted_loss(labels: torch.Tensor, num_classes: int) -> Callable:
    """
    Inverse-frequency weighted cross-entropy.
    class_weight = 1 / class_frequency
    """
    counts = torch.bincount(labels, minlength=num_classes).float()
    weights = 1.0 / (counts + 1e-6)
    weights = weights / weights.sum() * num_classes  # normalize

    def weighted_ce(logits, targets):
        return F.cross_entropy(logits, targets, weight=weights.to(logits.device))

    return weighted_ce


def get_focal_loss(gamma: float = 2.0, alpha: float | None = None) -> Callable:
    """
    Focal loss: FL = -(1-p)^gamma * log(p)
    Down-weights easy examples.
    """

    def focal_ce(logits, targets):
        ce = F.cross_entropy(logits, targets, reduction="none")
        pt = torch.exp(-ce)
        loss = ((1 - pt) ** gamma) * ce
        return loss.mean()

    return focal_ce


# ── Sampling Methods ────────────────────────────────────────────────────────

def oversample_mask(
    labels: torch.Tensor,
    train_mask: torch.Tensor,
    num_classes: int,
) -> torch.Tensor:
    """
    Random oversampling — duplicate minority class nodes in training mask
    up to majority count.
    """
    train_indices = train_mask.nonzero(as_tuple=True)[0]
    train_labels = labels[train_indices]
    counts = torch.bincount(train_labels, minlength=num_classes)
    max_count = int(counts.max().item())

    new_indices = []
    for c in range(num_classes):
        c_idx = train_indices[train_labels == c]
        if len(c_idx) == 0:
            continue
        repeats = max_count // len(c_idx) + 1
        expanded = c_idx.repeat(repeats)[:max_count]
        new_indices.append(expanded)

    return torch.cat(new_indices)


def undersample_mask(
    labels: torch.Tensor,
    train_mask: torch.Tensor,
    num_classes: int,
) -> torch.Tensor:
    """
    Random undersampling — randomly remove majority class nodes
    down to minority count.
    """
    train_indices = train_mask.nonzero(as_tuple=True)[0]
    train_labels = labels[train_indices]
    counts = torch.bincount(train_labels, minlength=num_classes)
    min_count = int(counts[counts > 0].min().item())

    new_indices = []
    for c in range(num_classes):
        c_idx = train_indices[train_labels == c]
        if len(c_idx) == 0:
            continue
        perm = torch.randperm(len(c_idx))[:min_count]
        new_indices.append(c_idx[perm])

    return torch.cat(new_indices)


# ── NodeImport ──────────────────────────────────────────────────────────────

def compute_node_importance(
    edge_index: torch.Tensor,
    labels: torch.Tensor,
    num_nodes: int,
    num_classes: int,
) -> torch.Tensor:
    """
    Compute per-node importance based on:
    1. Inverse class frequency (minority nodes get higher weight)
    2. Neighborhood label diversity (boundary nodes get higher weight)
    """
    # Inverse class frequency
    counts = torch.bincount(labels, minlength=num_classes).float()
    class_weights = 1.0 / (counts + 1e-6)
    class_weights = class_weights / class_weights.sum()
    node_class_weight = class_weights[labels]

    # Neighborhood diversity
    src, dst = edge_index
    diversity = torch.zeros(num_nodes, dtype=torch.float)
    for i in range(num_nodes):
        neighbors = dst[src == i]
        if len(neighbors) == 0:
            diversity[i] = 0.0
        else:
            unique_labels = labels[neighbors].unique()
            diversity[i] = len(unique_labels) / num_classes

    # Combine
    importance = 0.6 * node_class_weight + 0.4 * diversity
    importance = importance / (importance.max() + 1e-8)
    return importance


def get_nodeimport_weighted_loss(
    importance: torch.Tensor,
) -> Callable:
    """Weight cross-entropy by per-node importance."""

    def nodeimport_ce(logits, targets, node_indices=None):
        ce = F.cross_entropy(logits, targets, reduction="none")
        if node_indices is not None:
            weights = importance[node_indices]
        else:
            weights = importance[: len(targets)]
        return (ce * weights).mean()

    return nodeimport_ce


# ── Balance Preview (real data) ─────────────────────────────────────────────

def preview_balance_from_data(
    data: "torch_geometric.data.Data",
    method: str,
) -> dict[str, Any]:
    """
    Compute before/after class distribution for a real PyG dataset.
    Returns originalClassCounts, balancedClassCounts, originalIR, balancedIR,
    percentageImprovement.

    Notes:
    - weighted and focal do NOT change counts (they only modify loss weights).
    - oversample duplicates minority up to majority count.
    - undersample reduces majority down to minority count.
    - nodeimport and svwng do not change counts.
    - baseline does not change counts.
    """
    num_classes = int(data.y.max().item()) + 1
    train_labels = data.y[data.train_mask]
    original_counts = torch.bincount(train_labels, minlength=num_classes).tolist()

    max_c = max(original_counts)
    min_c = min(c for c in original_counts if c > 0) if any(c > 0 for c in original_counts) else 1
    original_ir = max_c / max(min_c, 1)

    # Compute balanced counts based on method
    if method == "oversample":
        balanced_counts = [max_c for _ in original_counts]
    elif method == "undersample":
        balanced_counts = [min_c for _ in original_counts]
    elif method in ("weighted", "focal", "nodeimport", "svwng", "baseline"):
        # These methods do NOT change sample counts
        balanced_counts = list(original_counts)
    else:
        balanced_counts = list(original_counts)

    max_b = max(balanced_counts) if balanced_counts else 1
    min_b = min(c for c in balanced_counts if c > 0) if any(c > 0 for c in balanced_counts) else 1
    balanced_ir = max_b / max(min_b, 1)

    pct_improvement = round(
        ((original_ir - balanced_ir) / original_ir * 100) if original_ir > 0 else 0, 2
    )

    return {
        "method": method,
        "original_counts": [
            {"class_id": f"C{i}", "count": c} for i, c in enumerate(original_counts)
        ],
        "balanced_counts": [
            {"class_id": f"C{i}", "count": c} for i, c in enumerate(balanced_counts)
        ],
        "original_ir": round(original_ir, 2),
        "balanced_ir": round(balanced_ir, 2),
        "ir_improvement": round(original_ir - balanced_ir, 2),
        "percentage_improvement": pct_improvement,
    }

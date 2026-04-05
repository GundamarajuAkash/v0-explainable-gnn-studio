"""
SVW-NG: Selective Validation-Weighted NodeImport Gating
=======================================================

Proposed ensemble method for class-imbalanced graph node classification.

Working mechanism:
1. Train multiple GNN models independently, each using a different
   imbalance-handling technique (baseline, weighted, focal, oversample,
   undersample, nodeimport).
2. Evaluate each model on the validation set — compute per-model MacroF1.
3. Compute validation-guided weights: w_i = softmax(MacroF1_i / temperature).
4. Compute node-level importance gating from the nodeimport service.
5. Final prediction = weighted sum of softmaxed logits, scaled by node importance.

Requires: torch, torch_geometric (real mode only).
"""

from __future__ import annotations

import os
from typing import Any

import torch
import torch.nn.functional as F
import numpy as np
from torch_geometric.data import Data
from sklearn.metrics import f1_score

from services.training_service import MODEL_REGISTRY, STORAGE_ROOT, _get_device, train_single
from services.imbalance_methods import compute_node_importance


# Base methods used by SVW-NG ensemble
ENSEMBLE_METHODS = ["baseline", "weighted", "focal", "oversample", "undersample", "nodeimport"]
TEMPERATURE = 2.0


def train_svwng(
    data: Data,
    model_name: str,
    dataset_id: str = "default",
    epochs: int = 200,
    lr: float = 0.01,
    hidden_dim: int = 64,
    dropout: float = 0.5,
    weight_decay: float = 5e-4,
    seed: int = 42,
) -> dict[str, Any]:
    """
    Train the SVW-NG ensemble for a given GNN architecture.

    Steps:
        1. Train 6 independent models (one per base method).
        2. Weight models by validation MacroF1 (softmax with temperature).
        3. Gate node predictions by node importance.
        4. Aggregate predictions and compute final metrics.
    """
    device = _get_device()
    data = data.to(device)
    num_classes = int(data.y.max().item()) + 1

    # ── Step 1: Train all base models ───────────────────────────────────
    base_results = []
    for method in ENSEMBLE_METHODS:
        result = train_single(
            data, model_name, method,
            dataset_id=dataset_id,
            epochs=epochs, lr=lr, hidden_dim=hidden_dim,
            dropout=dropout, weight_decay=weight_decay, seed=seed,
        )
        base_results.append(result)

    # ── Step 2: Compute validation-guided weights ───────────────────────
    val_f1_scores = []
    logits_list = []

    for i, method in enumerate(ENSEMBLE_METHODS):
        # Reload model
        ModelClass = MODEL_REGISTRY[model_name]
        model = ModelClass(data.num_features, hidden_dim, num_classes, dropout=dropout).to(device)

        import pickle
        model_path = os.path.join(STORAGE_ROOT, dataset_id, f"{model_name}_{method}.pkl")
        with open(model_path, "rb") as f:
            state = pickle.load(f)
        model.load_state_dict(state)

        model.eval()
        with torch.no_grad():
            out = model(data.x, data.edge_index)

            # Validation MacroF1
            val_pred = out[data.val_mask].argmax(dim=1).cpu().numpy()
            val_true = data.y[data.val_mask].cpu().numpy()
            macro_f1 = float(f1_score(val_true, val_pred, average="macro", zero_division=0))
            val_f1_scores.append(macro_f1)

            # Store test logits
            test_logits = out[data.test_mask]
            logits_list.append(test_logits)

    # Softmax weights with temperature
    f1_tensor = torch.tensor(val_f1_scores, dtype=torch.float32)
    weights = F.softmax(f1_tensor / TEMPERATURE, dim=0).to(device)

    # ── Step 3: Node importance gating ──────────────────────────────────
    node_importance = compute_node_importance(
        data.edge_index, data.y, data.num_nodes, num_classes
    )
    test_importance = node_importance[data.test_mask].to(device)
    # Normalize to [0.5, 1.5] range so it modulates but doesn't zero out
    gate = 0.5 + test_importance / (test_importance.max() + 1e-8)

    # ── Step 4: Weighted + gated aggregation ────────────────────────────
    weighted_logits = torch.zeros_like(logits_list[0])
    for i, logits in enumerate(logits_list):
        weighted_logits += weights[i] * F.softmax(logits, dim=1)

    # Apply node-importance gating
    gated_logits = weighted_logits * gate.unsqueeze(1)

    # Final predictions
    test_pred = gated_logits.argmax(dim=1).cpu().numpy()
    test_prob = F.softmax(gated_logits, dim=1).cpu().detach().numpy()
    test_true = data.y[data.test_mask].cpu().numpy()

    # Compute final metrics
    from services.metrics import compute_all_metrics
    metrics = compute_all_metrics(test_true, test_pred, test_prob, num_classes)

    # Use the average training curve from all base models
    avg_curve = _average_curves([r["training_curve"] for r in base_results])

    return {
        "model": model_name,
        "method": "svwng",
        **metrics,
        "training_curve": avg_curve,
        "model_path": None,
        "ensemble_weights": {
            method: round(float(weights[i].item()), 4)
            for i, method in enumerate(ENSEMBLE_METHODS)
        },
        "ensemble_val_f1": {
            method: round(val_f1_scores[i], 4)
            for i, method in enumerate(ENSEMBLE_METHODS)
        },
    }


def _average_curves(curves_list: list[list[dict]]) -> list[dict]:
    """Average training curves from multiple models."""
    if not curves_list or not curves_list[0]:
        return []

    num_epochs = len(curves_list[0])
    avg = []
    for e in range(num_epochs):
        epoch_data = {
            "epoch": e + 1,
            "train_loss": round(np.mean([c[e]["train_loss"] for c in curves_list]), 4),
            "val_loss": round(np.mean([c[e]["val_loss"] for c in curves_list]), 4),
            "train_acc": round(np.mean([c[e]["train_acc"] for c in curves_list]), 4),
            "val_acc": round(np.mean([c[e]["val_acc"] for c in curves_list]), 4),
        }
        avg.append(epoch_data)
    return avg

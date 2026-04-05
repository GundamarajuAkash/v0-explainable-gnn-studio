"""
Metric computation — real mode (requires numpy, sklearn).
ACC, bACC, MacroF1, ECE, Brier, WorstRecall, GMean, per-class, confusion matrix.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    confusion_matrix as sk_confusion_matrix,
    brier_score_loss,
)


def compute_all_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: np.ndarray,
    num_classes: int,
) -> dict[str, Any]:
    """
    Compute all benchmark metrics.

    Args:
        y_true:  (N,) ground truth labels
        y_pred:  (N,) predicted labels
        y_prob:  (N, C) predicted probabilities
        num_classes: number of classes

    Returns:
        Dict with overall metrics, per_class_metrics, confusion_matrix.
    """
    acc = float(accuracy_score(y_true, y_pred))
    bacc = float(balanced_accuracy_score(y_true, y_pred))
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))

    # ECE (Expected Calibration Error) — 15 bins
    ece = _compute_ece(y_true, y_pred, y_prob, n_bins=15)

    # Brier score (multi-class one-vs-rest average)
    brier = _compute_brier(y_true, y_prob, num_classes)

    # Per-class recall for WorstRecall and GMean
    per_class_recall = recall_score(y_true, y_pred, average=None, zero_division=0)
    worst_recall = float(np.min(per_class_recall)) if len(per_class_recall) > 0 else 0.0
    gmean = float(np.exp(np.mean(np.log(np.clip(per_class_recall, 1e-10, 1)))))

    # Per-class metrics
    per_class_prec = precision_score(y_true, y_pred, average=None, zero_division=0)
    per_class_f1 = f1_score(y_true, y_pred, average=None, zero_division=0)
    cm = sk_confusion_matrix(y_true, y_pred, labels=list(range(num_classes)))

    per_class_metrics = []
    for c in range(num_classes):
        tp = cm[c, c]
        fn = cm[c, :].sum() - tp
        fp = cm[:, c].sum() - tp
        tn = cm.sum() - tp - fn - fp
        spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        support = int(cm[c, :].sum())

        per_class_metrics.append({
            "class_id": f"C{c}",
            "precision": round(float(per_class_prec[c]), 4),
            "recall": round(float(per_class_recall[c]), 4),
            "f1": round(float(per_class_f1[c]), 4),
            "specificity": round(float(spec), 4),
            "fpr": round(float(fpr), 4),
            "support": support,
        })

    return {
        "ACC": round(acc, 4),
        "bACC": round(bacc, 4),
        "MacroF1": round(macro_f1, 4),
        "ECE": round(ece, 4),
        "Brier": round(brier, 4),
        "WorstRecall": round(worst_recall, 4),
        "GMean": round(gmean, 4),
        "per_class_metrics": per_class_metrics,
        "confusion_matrix": cm.tolist(),
    }


def _compute_ece(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: np.ndarray,
    n_bins: int = 15,
) -> float:
    """Expected Calibration Error."""
    confidences = np.max(y_prob, axis=1)
    correct = (y_pred == y_true).astype(float)
    bin_boundaries = np.linspace(0, 1, n_bins + 1)

    ece = 0.0
    for i in range(n_bins):
        mask = (confidences > bin_boundaries[i]) & (confidences <= bin_boundaries[i + 1])
        if mask.sum() == 0:
            continue
        bin_acc = correct[mask].mean()
        bin_conf = confidences[mask].mean()
        ece += mask.sum() / len(y_true) * abs(bin_acc - bin_conf)

    return float(ece)


def _compute_brier(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    num_classes: int,
) -> float:
    """Multi-class Brier score (one-vs-rest average)."""
    brier_total = 0.0
    for c in range(num_classes):
        y_bin = (y_true == c).astype(float)
        p_c = y_prob[:, c] if y_prob.ndim == 2 else np.zeros(len(y_true))
        brier_total += float(np.mean((p_c - y_bin) ** 2))
    return brier_total / num_classes

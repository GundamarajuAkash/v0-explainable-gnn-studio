"""
Dataset splitting utility — stratified train/val/test masks.
Used for Amazon datasets and any uploaded dataset missing masks.
"""

from __future__ import annotations

import torch
import numpy as np
from torch_geometric.data import Data


def create_masks(
    data: Data,
    train_ratio: float = 0.6,
    val_ratio: float = 0.2,
    test_ratio: float = 0.2,
    seed: int = 42,
) -> Data:
    """
    Create stratified train/val/test masks by sampling proportionally
    from each class.  Attaches train_mask, val_mask, test_mask to data.

    Args:
        data: PyG Data object (must have data.y)
        train_ratio: fraction of nodes for training
        val_ratio: fraction for validation
        test_ratio: fraction for testing
        seed: random seed for reproducibility

    Returns:
        Same Data object with masks attached.
    """
    assert abs(train_ratio + val_ratio + test_ratio - 1.0) < 1e-6, \
        "Ratios must sum to 1.0"

    rng = np.random.RandomState(seed)
    n = data.num_nodes
    num_classes = int(data.y.max().item()) + 1

    train_mask = torch.zeros(n, dtype=torch.bool)
    val_mask = torch.zeros(n, dtype=torch.bool)
    test_mask = torch.zeros(n, dtype=torch.bool)

    labels = data.y.cpu().numpy()

    for c in range(num_classes):
        class_indices = np.where(labels == c)[0]
        rng.shuffle(class_indices)
        nc = len(class_indices)

        if nc == 0:
            continue

        # Ensure at least 1 node per split if class has >= 3 nodes
        n_train = max(1, int(nc * train_ratio))
        n_val = max(1, int(nc * val_ratio))
        n_test = max(1, nc - n_train - n_val)

        # Adjust if rounding pushed total over
        if n_train + n_val + n_test > nc:
            n_test = nc - n_train - n_val

        train_idx = class_indices[:n_train]
        val_idx = class_indices[n_train : n_train + n_val]
        test_idx = class_indices[n_train + n_val : n_train + n_val + n_test]

        train_mask[torch.tensor(train_idx, dtype=torch.long)] = True
        val_mask[torch.tensor(val_idx, dtype=torch.long)] = True
        test_mask[torch.tensor(test_idx, dtype=torch.long)] = True

    data.train_mask = train_mask
    data.val_mask = val_mask
    data.test_mask = test_mask

    return data


def needs_masks(data: Data) -> bool:
    """Check if a PyG data object is missing train/val/test masks."""
    for attr in ("train_mask", "val_mask", "test_mask"):
        if not hasattr(data, attr) or getattr(data, attr) is None:
            return True
        mask = getattr(data, attr)
        if isinstance(mask, torch.Tensor) and mask.sum().item() == 0:
            return True
    return False

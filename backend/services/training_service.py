"""
GNN model training service — real mode.
Supports: GCN, GAT, GraphSAGE, ChebNet, GIN, PinSAGE.
Requires: torch, torch_geometric.
"""

from __future__ import annotations

import os
import pickle
import random
import time
from typing import Any

import torch
import torch.nn.functional as F
import numpy as np
from torch_geometric.data import Data
from torch_geometric.datasets import Planetoid, Amazon
from torch_geometric.nn import (
    GCNConv,
    GATConv,
    SAGEConv,
    ChebConv,
    GINConv,
)

from services.metrics import compute_all_metrics
from services.dataset_split import create_masks, needs_masks
from services.graph_stats import compute_graph_stats_from_pyg
from services.imbalance_methods import (
    get_baseline_loss,
    get_weighted_loss,
    get_focal_loss,
    oversample_mask,
    undersample_mask,
    compute_node_importance,
    get_nodeimport_weighted_loss,
)


SEED = int(os.getenv("RANDOM_SEED", "42"))
FORCE_CPU = os.getenv("FORCE_CPU", "false").lower() == "true"
STORAGE_ROOT = os.getenv(
    "MODEL_STORAGE_DIR",
    os.path.join(os.path.dirname(__file__), "..", "storage", "models"),
)
os.makedirs(STORAGE_ROOT, exist_ok=True)


def _get_device() -> torch.device:
    """Return the compute device, respecting FORCE_CPU env var."""
    if FORCE_CPU:
        return torch.device("cpu")
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _model_dir(dataset_id: str) -> str:
    """Return /storage/models/{dataset_id}/, creating if needed."""
    d = os.path.join(STORAGE_ROOT, dataset_id)
    os.makedirs(d, exist_ok=True)
    return d


# ═══════════════════════════════════════════════════════════════════════════
#  GNN Model Definitions
# ═══════════════════════════════════════════════════════════════════════════

class GCNModel(torch.nn.Module):
    def __init__(self, in_channels, hidden, out_channels, dropout=0.5):
        super().__init__()
        self.conv1 = GCNConv(in_channels, hidden)
        self.conv2 = GCNConv(hidden, out_channels)
        self.dropout = dropout

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv2(x, edge_index)
        return x


class GATModel(torch.nn.Module):
    def __init__(self, in_channels, hidden, out_channels, heads=8, dropout=0.5):
        super().__init__()
        self.conv1 = GATConv(in_channels, hidden // heads, heads=heads, dropout=dropout)
        self.conv2 = GATConv(hidden, out_channels, heads=1, concat=False, dropout=dropout)
        self.dropout = dropout

    def forward(self, x, edge_index):
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv1(x, edge_index)
        x = F.elu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv2(x, edge_index)
        return x


class GraphSAGEModel(torch.nn.Module):
    def __init__(self, in_channels, hidden, out_channels, dropout=0.5):
        super().__init__()
        self.conv1 = SAGEConv(in_channels, hidden)
        self.conv2 = SAGEConv(hidden, out_channels)
        self.dropout = dropout

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv2(x, edge_index)
        return x


class ChebNetModel(torch.nn.Module):
    def __init__(self, in_channels, hidden, out_channels, K=3, dropout=0.5):
        super().__init__()
        self.conv1 = ChebConv(in_channels, hidden, K=K)
        self.conv2 = ChebConv(hidden, out_channels, K=K)
        self.dropout = dropout

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv2(x, edge_index)
        return x


class GINModel(torch.nn.Module):
    def __init__(self, in_channels, hidden, out_channels, dropout=0.5):
        super().__init__()
        nn1 = torch.nn.Sequential(
            torch.nn.Linear(in_channels, hidden),
            torch.nn.ReLU(),
            torch.nn.Linear(hidden, hidden),
        )
        nn2 = torch.nn.Sequential(
            torch.nn.Linear(hidden, hidden),
            torch.nn.ReLU(),
            torch.nn.Linear(hidden, out_channels),
        )
        self.conv1 = GINConv(nn1)
        self.conv2 = GINConv(nn2)
        self.dropout = dropout

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv2(x, edge_index)
        return x


class PinSAGEModel(torch.nn.Module):
    """PinSAGE-style: SAGE convolutions with residual connections and neighbor aggregation."""
    def __init__(self, in_channels, hidden, out_channels, dropout=0.5):
        super().__init__()
        self.conv1 = SAGEConv(in_channels, hidden)
        self.conv2 = SAGEConv(hidden, hidden)
        self.lin = torch.nn.Linear(hidden, out_channels)
        self.dropout = dropout

    def forward(self, x, edge_index):
        h = self.conv1(x, edge_index)
        h = F.relu(h)
        h = F.dropout(h, p=self.dropout, training=self.training)
        h2 = self.conv2(h, edge_index)
        h = h + h2  # residual
        h = F.relu(h)
        h = self.lin(h)
        return h


MODEL_REGISTRY = {
    "GCN": GCNModel,
    "GAT": GATModel,
    "GraphSAGE": GraphSAGEModel,
    "ChebNet": ChebNetModel,
    "GIN": GINModel,
    "PinSAGE": PinSAGEModel,
}


# ═══════════════════════════════════════════════════════════════════════════
#  Dataset Loading
# ═══════════════════════════════════════════════════════════════════════════

# Available PyG datasets with metadata (restricted to 5 datasets with pre-computed results)
AVAILABLE_PYG_DATASETS = {
    # Planetoid citation networks
    "Cora": {"type": "Planetoid", "description": "Citation network of ML papers", "num_classes": 7},
    "CiteSeer": {"type": "Planetoid", "description": "Citation network of CS papers", "num_classes": 6},
    "PubMed": {"type": "Planetoid", "description": "Citation network of diabetes papers", "num_classes": 3},
    # Amazon co-purchase graphs
    "Amazon-Photo": {"type": "Amazon", "name": "Photo", "description": "Amazon product co-purchase (Photo)", "num_classes": 8},
    "Amazon-Computers": {"type": "Amazon", "name": "Computers", "description": "Amazon product co-purchase (Computers)", "num_classes": 10},
}


def list_available_datasets() -> list[dict[str, Any]]:
    """Return list of all available PyG datasets with metadata."""
    return [
        {"name": name, **meta}
        for name, meta in AVAILABLE_PYG_DATASETS.items()
    ]


def load_pyg_dataset(name: str) -> tuple[Data, dict[str, Any]]:
    """
    Load a built-in dataset via PyTorch Geometric.
    Automatically applies stratified splitting for datasets missing masks.
    """
    if name not in AVAILABLE_PYG_DATASETS:
        raise ValueError(f"Unknown dataset: {name}. Available: {list(AVAILABLE_PYG_DATASETS.keys())}")

    data_root = os.path.join(os.path.dirname(__file__), "..", "data")
    meta = AVAILABLE_PYG_DATASETS[name]

    if meta["type"] == "Planetoid":
        dataset = Planetoid(root=data_root, name=name)
    elif meta["type"] == "Amazon":
        dataset = Amazon(root=data_root, name=meta["name"])
    else:
        raise ValueError(f"Unknown dataset type: {meta['type']}")

    data = dataset[0]

    # Apply stratified splitting if masks are missing
    if needs_masks(data):
        data = create_masks(data, train_ratio=0.6, val_ratio=0.2, test_ratio=0.2, seed=SEED)

    summary = compute_graph_stats_from_pyg(data, name=name)
    summary["id"] = name.lower().replace(" ", "-")
    summary["is_builtin"] = True
    summary["description"] = meta.get("description", "")

    return data, summary


# ═══════════════════════════════════════════════════════════════════════════
#  Training Loop
# ═══════════════════════════════════════════════════════════════════════════

def train_single(
    data: Data,
    model_name: str,
    method_name: str,
    dataset_id: str = "default",
    epochs: int = 200,
    lr: float = 0.01,
    hidden_dim: int = 64,
    dropout: float = 0.5,
    weight_decay: float = 5e-4,
    seed: int = 42,
) -> dict[str, Any]:
    """
    Train a single model+method combination and return full metrics.
    Saves model to /storage/models/{dataset_id}/{model}_{method}.pkl
    """
    # Full reproducibility
    random.seed(seed)
    torch.manual_seed(seed)
    np.random.seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

    device = _get_device()
    data = data.to(device)

    num_classes = int(data.y.max().item()) + 1

    # Train mask safety check
    if data.train_mask.sum() == 0:
        raise ValueError("Training mask is empty — cannot train. Apply create_masks first.")

    # Delegate SVWNG to its own ensemble trainer
    if method_name == "svwng":
        from services.svwng import train_svwng
        return train_svwng(
            data, model_name, dataset_id=dataset_id,
            epochs=epochs, lr=lr, hidden_dim=hidden_dim,
            dropout=dropout, weight_decay=weight_decay, seed=seed,
        )

    # Build model
    ModelClass = MODEL_REGISTRY[model_name]
    model = ModelClass(data.num_features, hidden_dim, num_classes, dropout=dropout).to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=weight_decay)

    # Get loss function / sampling based on method
    train_indices = None  # None = use mask
    loss_fn = None
    node_importance = None

    if method_name == "baseline":
        loss_fn = get_baseline_loss()
    elif method_name == "weighted":
        loss_fn = get_weighted_loss(data.y[data.train_mask], num_classes)
    elif method_name == "focal":
        loss_fn = get_focal_loss(gamma=2.0)
    elif method_name == "oversample":
        train_indices = oversample_mask(data.y, data.train_mask, num_classes)
        loss_fn = get_baseline_loss()
    elif method_name == "undersample":
        train_indices = undersample_mask(data.y, data.train_mask, num_classes)
        loss_fn = get_baseline_loss()
    elif method_name == "nodeimport":
        node_importance = compute_node_importance(
            data.edge_index, data.y, data.num_nodes, num_classes
        )
        loss_fn = get_nodeimport_weighted_loss(node_importance.to(device))
    else:
        loss_fn = get_baseline_loss()

    # Training curves
    curve = []

    for epoch in range(1, epochs + 1):
        model.train()
        optimizer.zero_grad()
        out = model(data.x, data.edge_index)

        if train_indices is not None:
            loss = F.cross_entropy(out[train_indices], data.y[train_indices])
        elif method_name == "nodeimport" and node_importance is not None:
            train_idx = data.train_mask.nonzero(as_tuple=True)[0]
            ce = F.cross_entropy(out[data.train_mask], data.y[data.train_mask], reduction="none")
            weights = node_importance[train_idx].to(device)
            loss = (ce * weights).mean()
        else:
            loss = loss_fn(out[data.train_mask], data.y[data.train_mask])

        loss.backward()
        optimizer.step()

        # Validation
        model.eval()
        with torch.no_grad():
            out_eval = model(data.x, data.edge_index)
            val_loss = float(F.cross_entropy(out_eval[data.val_mask], data.y[data.val_mask]).item())
            train_pred = out_eval[data.train_mask].argmax(dim=1)
            val_pred = out_eval[data.val_mask].argmax(dim=1)
            train_acc = float((train_pred == data.y[data.train_mask]).float().mean().item())
            val_acc = float((val_pred == data.y[data.val_mask]).float().mean().item())

        curve.append({
            "epoch": epoch,
            "train_loss": round(float(loss.item()), 4),
            "val_loss": round(val_loss, 4),
            "train_acc": round(train_acc, 4),
            "val_acc": round(val_acc, 4),
        })

    # Final evaluation on test set
    model.eval()
    with torch.no_grad():
        out_final = model(data.x, data.edge_index)
        test_prob = F.softmax(out_final[data.test_mask], dim=1).cpu().numpy()
        test_pred = out_final[data.test_mask].argmax(dim=1).cpu().numpy()
        test_true = data.y[data.test_mask].cpu().numpy()

    metrics = compute_all_metrics(test_true, test_pred, test_prob, num_classes)

    # Save model to /storage/models/{dataset_id}/{model}_{method}.pkl
    model_dir = _model_dir(dataset_id)
    model_path = os.path.join(model_dir, f"{model_name}_{method_name}.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(model.state_dict(), f)

    return {
        "model": model_name,
        "method": method_name,
        **metrics,
        "training_curve": curve,
        "model_path": model_path,
    }


def train_batch(
    data: Data,
    models: list[str],
    methods: list[str],
    dataset_id: str = "default",
    **kwargs,
) -> list[dict[str, Any]]:
    """Train all model x method combinations."""
    results = []
    for model_name in models:
        for method_name in methods:
            result = train_single(data, model_name, method_name, dataset_id=dataset_id, **kwargs)
            results.append(result)
    return results

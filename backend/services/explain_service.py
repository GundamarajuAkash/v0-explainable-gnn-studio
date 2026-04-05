"""
Explainability service — GNNExplainer wrapper (real mode).
Requires: torch, torch_geometric.
Uses dataset_cache for data access.
"""

from __future__ import annotations

import os
import pickle
from typing import Any

import torch
import torch.nn.functional as F
import numpy as np
from torch_geometric.data import Data
from torch_geometric.explain import Explainer, GNNExplainer

from services.training_service import MODEL_REGISTRY, STORAGE_ROOT, _get_device
from services import dataset_cache


def _model_path(dataset_id: str, model_name: str, method_name: str) -> str:
    """Model path: /storage/models/{dataset_id}/{model}_{method}.pkl"""
    return os.path.join(STORAGE_ROOT, dataset_id, f"{model_name}_{method_name}.pkl")


def run_gnnexplainer(
    dataset_id: str,
    model_name: str,
    method_name: str,
    node_id: int,
    hidden_dim: int = 64,
    dropout: float = 0.5,
) -> dict[str, Any]:
    """
    Run GNNExplainer on a specific node.
    Returns subgraph, feature importance, fidelity, coverage.
    """
    # Load model
    mp = _model_path(dataset_id, model_name, method_name)
    if not os.path.exists(mp):
        raise FileNotFoundError(
            f"No trained model found at {mp} for {model_name}+{method_name}. Train first."
        )

    # Get cached PyG data
    data = dataset_cache.get_dataset(dataset_id)
    if data is None:
        # Fallback: try loading from PyG
        from services.training_service import load_pyg_dataset

        dataset_map = {
            "cora": "Cora",
            "citeseer": "CiteSeer",
            "pubmed": "PubMed",
            "amazon-photo": "Amazon-Photo",
            "amazon-computers": "Amazon-Computers",
        }
        ds_name = dataset_map.get(dataset_id, dataset_id)
        data, summary = load_pyg_dataset(ds_name)
        dataset_cache.store_dataset(dataset_id, data, summary)

    device = _get_device()
    data = data.to(device)
    num_classes = int(data.y.max().item()) + 1

    # Validate node_id
    if node_id < 0 or node_id >= data.num_nodes:
        raise ValueError(f"node_id {node_id} exceeds dataset size ({data.num_nodes})")

    # Reconstruct model
    ModelClass = MODEL_REGISTRY[model_name]
    model = ModelClass(data.num_features, hidden_dim, num_classes, dropout=dropout).to(device)

    with open(mp, "rb") as f:
        state = pickle.load(f)
    model.load_state_dict(state)
    model.eval()

    # Run GNNExplainer
    explainer = Explainer(
        model=model,
        algorithm=GNNExplainer(epochs=200, lr=0.01),
        explanation_type="model",
        node_mask_type="attributes",
        edge_mask_type="object",
        model_config=dict(
            mode="multiclass_classification",
            task_level="node",
            return_type="raw",
        ),
    )

    explanation = explainer(data.x, data.edge_index, index=node_id)

    # Extract results
    with torch.no_grad():
        out = model(data.x, data.edge_index)
        pred = int(out[node_id].argmax().item())
        confidence = float(F.softmax(out[node_id], dim=0).max().item())

    true_class = int(data.y[node_id].item())

    # Extract subgraph
    edge_mask = explanation.edge_mask
    node_mask = explanation.node_mask

    # Get top edges by mask value
    top_k = min(20, len(edge_mask))
    top_edge_idx = edge_mask.topk(top_k).indices

    subgraph_node_ids = set()
    subgraph_edges = []
    for idx in top_edge_idx:
        src = int(data.edge_index[0, idx].item())
        dst = int(data.edge_index[1, idx].item())
        w = float(edge_mask[idx].item())
        subgraph_node_ids.add(src)
        subgraph_node_ids.add(dst)
        subgraph_edges.append({"source": src, "target": dst, "weight": round(w, 4)})

    subgraph_nodes = []
    for nid in subgraph_node_ids:
        imp = float(node_mask[nid].mean().item()) if node_mask is not None else 0.5
        subgraph_nodes.append({
            "id": nid,
            "label": int(data.y[nid].item()),
            "importance": round(imp, 4),
        })

    # Feature importance — average node mask across features
    if node_mask is not None and node_mask.dim() >= 1:
        if node_mask.dim() == 2:
            feat_imp = node_mask[node_id].cpu().numpy()
        else:
            feat_imp = node_mask.cpu().numpy()
        top_feats = min(10, len(feat_imp))
        top_idx = np.argsort(feat_imp)[-top_feats:][::-1]
        feature_importance = [
            {"feature_name": f"feat_{i}", "importance": round(float(feat_imp[i]), 4)}
            for i in top_idx
        ]
    else:
        feature_importance = [{"feature_name": f"feat_{i}", "importance": 0.5} for i in range(10)]

    # Fidelity: how much prediction changes without explanation subgraph
    fidelity = _compute_fidelity(model, data, node_id, edge_mask, pred)

    # Coverage: fraction of important nodes in the k-hop neighborhood captured
    coverage = _compute_coverage(data, node_id, subgraph_node_ids)

    return {
        "nodeId": node_id,
        "predictedClass": pred,
        "trueClass": true_class,
        "confidence": round(confidence, 4),
        "subgraphNodes": subgraph_nodes,
        "subgraphEdges": subgraph_edges,
        "featureImportance": feature_importance,
        "fidelity": round(fidelity, 4),
        "coverage": round(coverage, 4),
    }


def _compute_fidelity(
    model: torch.nn.Module,
    data: Data,
    node_id: int,
    edge_mask: torch.Tensor,
    original_pred: int,
) -> float:
    """Fidelity = P(original pred) - P(original pred | important edges removed)."""
    model.eval()
    with torch.no_grad():
        # Original probability
        out = model(data.x, data.edge_index)
        orig_prob = float(F.softmax(out[node_id], dim=0)[original_pred].item())

        # Remove top explanation edges
        threshold = edge_mask.quantile(0.7).item()
        keep = edge_mask < threshold
        new_edge_index = data.edge_index[:, keep]

        out2 = model(data.x, new_edge_index)
        new_prob = float(F.softmax(out2[node_id], dim=0)[original_pred].item())

    return max(0, orig_prob - new_prob)


def _compute_coverage(
    data: Data,
    node_id: int,
    subgraph_node_ids: set[int],
) -> float:
    """
    Coverage = fraction of 2-hop neighborhood nodes captured by the explanation subgraph.
    """
    # Get 1-hop neighbors
    src, dst = data.edge_index
    hop1 = set(dst[src == node_id].cpu().numpy().tolist())
    hop1.add(node_id)

    # Get 2-hop neighbors
    hop2 = set()
    for n in hop1:
        neighbors = dst[src == n].cpu().numpy().tolist()
        hop2.update(neighbors)
    hop2.update(hop1)

    if len(hop2) == 0:
        return 1.0

    captured = subgraph_node_ids & hop2
    return len(captured) / len(hop2)


def run_global_explanation(
    dataset_id: str,
    model_name: str,
    method_name: str,
    num_samples: int = 50,
) -> dict[str, Any]:
    """
    Compute global explainability metrics by aggregating node-level explanations.
    """
    data = dataset_cache.get_dataset(dataset_id)
    if data is None:
        from services.training_service import load_pyg_dataset
        dataset_map = {
            "cora": "Cora",
            "citeseer": "CiteSeer",
            "pubmed": "PubMed",
            "amazon-photo": "Amazon-Photo",
            "amazon-computers": "Amazon-Computers",
        }
        ds_name = dataset_map.get(dataset_id, dataset_id)
        data, summary = load_pyg_dataset(ds_name)
        dataset_cache.store_dataset(dataset_id, data, summary)

    num_classes = int(data.y.max().item()) + 1

    # Sample nodes from each class (test set)
    rng = np.random.RandomState(42)
    per_class_results: dict[int, list[dict]] = {c: [] for c in range(num_classes)}

    test_indices = data.test_mask.nonzero(as_tuple=True)[0].numpy()
    sample_indices = rng.choice(
        test_indices,
        size=min(num_samples, len(test_indices)),
        replace=False,
    )

    for nid in sample_indices:
        nid = int(nid)
        try:
            result = run_gnnexplainer(dataset_id, model_name, method_name, nid)
            true_c = result["true_class"]
            per_class_results[true_c].append(result)
        except Exception:
            continue

    # Aggregate
    per_class = []
    all_fidelities = []
    all_coverages = []

    for c in range(num_classes):
        results = per_class_results[c]
        if not results:
            per_class.append({
                "class_id": f"C{c}",
                "avg_fidelity": 0.0,
                "avg_coverage": 0.0,
                "avg_subgraph_size": 0.0,
            })
            continue

        fids = [r["fidelity"] for r in results]
        covs = [r["coverage"] for r in results]
        sizes = [len(r["subgraph_nodes"]) for r in results]
        all_fidelities.extend(fids)
        all_coverages.extend(covs)

        per_class.append({
            "class_id": f"C{c}",
            "avg_fidelity": round(float(np.mean(fids)), 4),
            "avg_coverage": round(float(np.mean(covs)), 4),
            "avg_subgraph_size": round(float(np.mean(sizes)), 2),
        })

    # Stability (Jaccard similarity between explanations of same class)
    stability = []
    for c in range(num_classes):
        results = per_class_results[c]
        if len(results) < 2:
            stability.append({"class_id": f"C{c}", "mean_jaccard": 0.0})
            continue

        jaccards = []
        for i in range(len(results)):
            for j in range(i + 1, min(len(results), i + 5)):
                set_i = {n["id"] for n in results[i]["subgraph_nodes"]}
                set_j = {n["id"] for n in results[j]["subgraph_nodes"]}
                inter = len(set_i & set_j)
                union = len(set_i | set_j)
                jaccards.append(inter / union if union > 0 else 0.0)

        stability.append({
            "class_id": f"C{c}",
            "mean_jaccard": round(float(np.mean(jaccards)), 4),
        })

    return {
        "per_class": per_class,
        "stability": stability,
        "overall_fidelity": round(float(np.mean(all_fidelities)) if all_fidelities else 0, 4),
        "overall_coverage": round(float(np.mean(all_coverages)) if all_coverages else 0, 4),
    }

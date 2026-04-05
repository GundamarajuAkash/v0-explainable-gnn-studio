"""
Dataset routes — upload, load from URL, list, get by ID.
Uses shared dataset_cache for in-memory PyG Data storage.
"""

from __future__ import annotations

import os
import uuid

import httpx
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from db.schemas import (
    APIResponse,
    DatasetSummary,
    GraphUpload,
    DatasetURLRequest,
    LoadBuiltInRequest,
)
from db.database import get_db
from db.models import Dataset as DatasetModel
from services.mock_service import (
    BUILTIN_DATASETS,
    get_builtin_dataset_summary,
)
from services.graph_stats import compute_graph_stats
from services import dataset_cache

router = APIRouter()

MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"


def _persist_dataset_to_db(db: Session, summary: dict) -> None:
    """Upsert a dataset record to the datasets SQL table."""
    try:
        existing = db.query(DatasetModel).filter(DatasetModel.id == summary["id"]).first()
        if existing:
            return  # already persisted
        row = DatasetModel(
            id=summary["id"],
            name=summary["name"],
            num_nodes=summary["num_nodes"],
            num_edges=summary["num_edges"],
            num_features=summary["num_features"],
            num_classes=summary["num_classes"],
            density=summary.get("density", 0),
            avg_degree=summary.get("avg_degree", 0),
            class_counts=summary.get("class_counts", []),
            imbalance_ratio=summary.get("imbalance_ratio", 1),
            major_class=summary.get("major_class", 0),
            minor_class=summary.get("minor_class", 0),
            is_builtin=summary.get("is_builtin", False),
        )
        db.add(row)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[datasets] SQL persist failed (non-fatal): {e}")

# ── Size limits ─────────────────────────────────────────────────────────────
MAX_NODES = int(os.getenv("MAX_UPLOAD_NODES", "50000"))
MAX_EDGES = int(os.getenv("MAX_UPLOAD_EDGES", "500000"))


def _init_builtins():
    """Pre-populate built-in dataset summaries (mock-mode friendly)."""
    for name in BUILTIN_DATASETS:
        summary = get_builtin_dataset_summary(name)
        dataset_cache.store_summary(summary["id"], summary)


_init_builtins()


# ── GET /api/datasets ───────────────────────────────────────────────────────

@router.get("/api/datasets")
async def list_datasets():
    """Return all dataset summaries."""
    summaries = dataset_cache.list_summaries()
    return APIResponse(
        status="success",
        message=f"{len(summaries)} dataset(s) available",
        data=summaries,
    )


# ── GET /api/dataset/{dataset_id} ──────────────────────────────────────────

@router.get("/api/dataset/{dataset_id}")
async def get_dataset(dataset_id: str):
    """Return full dataset summary by ID."""
    summary = dataset_cache.get_summary(dataset_id)
    if not summary:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")
    return APIResponse(status="success", message="Dataset found", data=summary)


# ── POST /api/load-builtin ─────────────────────────────────────────────────

@router.post("/api/load-builtin")
async def load_builtin(req: LoadBuiltInRequest, db: Session = Depends(get_db)):
    """
    Load a built-in dataset (Cora, CiteSeer, PubMed, Amazon-Photo, Amazon-Computers).
    In mock mode: returns pre-computed summaries.
    In real mode: downloads via PyTorch Geometric, applies stratified split, caches Data object.
    """
    name = req.dataset.value
    if name not in BUILTIN_DATASETS:
        raise HTTPException(status_code=400, detail=f"Unknown built-in dataset: {name}")

    if MOCK_MODE:
        summary = get_builtin_dataset_summary(name)
        dataset_cache.store_summary(summary["id"], summary)
        _persist_dataset_to_db(db, summary)
        return APIResponse(status="success", message=f"Loaded {name}", data=summary)

    # Real mode: load via PyTorch Geometric with stratified splitting
    try:
        from services.training_service import load_pyg_dataset

        data, summary = load_pyg_dataset(name)
        dataset_cache.store_dataset(summary["id"], data, summary)
        _persist_dataset_to_db(db, summary)
        return APIResponse(
            status="success",
            message=f"Loaded {name} via PyG ({data.num_nodes} nodes, {data.num_edges} edges)",
            data=summary,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /api/upload-dataset ───────────────────────────────────────────────

@router.post("/api/upload-dataset")
async def upload_dataset(graph: GraphUpload, db: Session = Depends(get_db)):
    """Upload a custom JSON graph dataset."""
    if len(graph.nodes) == 0:
        raise HTTPException(status_code=400, detail="Dataset must have at least 1 node")
    if len(graph.edges) == 0:
        raise HTTPException(status_code=400, detail="Dataset must have at least 1 edge")
    if len(graph.nodes) > MAX_NODES:
        raise HTTPException(status_code=413, detail=f"Dataset too large: {len(graph.nodes)} nodes exceeds limit of {MAX_NODES}")
    if len(graph.edges) > MAX_EDGES:
        raise HTTPException(status_code=413, detail=f"Dataset too large: {len(graph.edges)} edges exceeds limit of {MAX_EDGES}")

    nodes_dicts = [n.model_dump() if hasattr(n, "model_dump") else n for n in graph.nodes]
    edges_dicts = [e.model_dump() if hasattr(e, "model_dump") else e for e in graph.edges]

    summary = compute_graph_stats(
        nodes=nodes_dicts,
        edges=edges_dicts,
        num_classes=graph.num_classes,
        feature_dim=graph.feature_dim,
        name=graph.name,
    )
    dataset_id = f"custom-{uuid.uuid4().hex[:8]}"
    summary["id"] = dataset_id

    if not MOCK_MODE:
        # Convert JSON to PyG Data for real training
        try:
            import torch
            from torch_geometric.data import Data as PyGData
            from services.dataset_split import create_masks, needs_masks

            # Build feature tensor with validation
            features = [n.get("features", []) for n in nodes_dicts]
            if not features or len(features[0]) == 0:
                raise HTTPException(
                    status_code=400,
                    detail="Nodes must include feature vectors (non-empty 'features' array)"
                )
            x = torch.tensor(features, dtype=torch.float)

            # Build edge_index
            src = [e["source"] for e in edges_dicts]
            dst = [e["target"] for e in edges_dicts]
            edge_index = torch.tensor([src + dst, dst + src], dtype=torch.long)

            # Build labels
            labels = [n.get("label", 0) for n in nodes_dicts]
            y = torch.tensor(labels, dtype=torch.long)

            pyg_data = PyGData(x=x, edge_index=edge_index, y=y)

            # Apply masks from request or generate via stratified split
            if graph.train_mask and graph.val_mask and graph.test_mask:
                n = pyg_data.num_nodes
                pyg_data.train_mask = torch.zeros(n, dtype=torch.bool)
                pyg_data.val_mask = torch.zeros(n, dtype=torch.bool)
                pyg_data.test_mask = torch.zeros(n, dtype=torch.bool)
                pyg_data.train_mask[torch.tensor(graph.train_mask)] = True
                pyg_data.val_mask[torch.tensor(graph.val_mask)] = True
                pyg_data.test_mask[torch.tensor(graph.test_mask)] = True
            else:
                pyg_data = create_masks(pyg_data)

            dataset_cache.store_dataset(dataset_id, pyg_data, summary)
        except Exception as e:
            # Fall back to summary-only on conversion failure
            dataset_cache.store_summary(dataset_id, summary)
    else:
        dataset_cache.store_summary(dataset_id, summary)

    _persist_dataset_to_db(db, summary)

    return APIResponse(
        status="success",
        message=f"Uploaded dataset '{graph.name}' with {len(graph.nodes)} nodes",
        data=summary,
    )


# ── POST /api/load-dataset-from-url ────────────────────────────────────────

@router.post("/api/load-dataset-from-url")
async def load_from_url(req: DatasetURLRequest, db: Session = Depends(get_db)):
    """Fetch a JSON graph from URL and load it."""
    if not req.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(req.url)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {str(e)}")

    try:
        graph = GraphUpload(**data)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"URL response is not a valid graph JSON: {str(e)}",
        )

    name = req.name or graph.name
    nodes_dicts = [n if isinstance(n, dict) else n for n in data.get("nodes", [])]
    edges_dicts = [e if isinstance(e, dict) else e for e in data.get("edges", [])]

    # Size limits
    if len(nodes_dicts) > MAX_NODES:
        raise HTTPException(status_code=413, detail=f"URL dataset too large: {len(nodes_dicts)} nodes exceeds limit of {MAX_NODES}")
    if len(edges_dicts) > MAX_EDGES:
        raise HTTPException(status_code=413, detail=f"URL dataset too large: {len(edges_dicts)} edges exceeds limit of {MAX_EDGES}")

    summary = compute_graph_stats(
        nodes=nodes_dicts,
        edges=edges_dicts,
        num_classes=graph.num_classes,
        feature_dim=graph.feature_dim,
        name=name,
    )
    dataset_id = f"url-{uuid.uuid4().hex[:8]}"
    summary["id"] = dataset_id

    if not MOCK_MODE:
        # Convert URL JSON to PyG Data so it can be trained
        try:
            import torch
            from torch_geometric.data import Data as PyGData
            from services.dataset_split import create_masks

            features = [n.get("features", []) for n in nodes_dicts]
            if not features or len(features[0]) == 0:
                raise HTTPException(
                    status_code=400,
                    detail="URL dataset nodes must include feature vectors"
                )
            x = torch.tensor(features, dtype=torch.float)

            src = [e["source"] for e in edges_dicts]
            dst = [e["target"] for e in edges_dicts]
            edge_index = torch.tensor([src + dst, dst + src], dtype=torch.long)

            labels = [n.get("label", 0) for n in nodes_dicts]
            y = torch.tensor(labels, dtype=torch.long)

            pyg_data = PyGData(x=x, edge_index=edge_index, y=y)
            pyg_data = create_masks(pyg_data)

            dataset_cache.store_dataset(dataset_id, pyg_data, summary)
        except HTTPException:
            raise
        except Exception as e:
            # Fall back to summary-only on conversion failure
            dataset_cache.store_summary(dataset_id, summary)
    else:
        dataset_cache.store_summary(dataset_id, summary)

    _persist_dataset_to_db(db, summary)

    return APIResponse(
        status="success",
        message=f"Loaded dataset '{name}' from URL ({len(nodes_dicts)} nodes)",
        data=summary,
    )

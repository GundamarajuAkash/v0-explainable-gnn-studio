"""
Explainability routes — POST /api/explain, POST /api/explain-global.
Uses Redis for caching, SQL for persistence, dataset_cache for data access.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from db.schemas import APIResponse, ExplainRequest, GlobalExplainRequest
from db.database import get_db
from db.models import Explanation as ExplanationModel
from services.mock_service import (
    generate_explanation,
    generate_global_explanation,
    BUILTIN_DATASETS,
)
from services import dataset_cache
from services.redis_cache import (
    cache_get,
    cache_set,
    explain_cache_key,
)

router = APIRouter()

MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"


def _get_dataset_info(dataset_id: str) -> dict:
    """Resolve dataset info from cache or built-in defaults."""
    summary = dataset_cache.get_summary(dataset_id)
    if summary:
        return summary
    for name, ds in BUILTIN_DATASETS.items():
        if name.lower().replace(" ", "-") == dataset_id or name == dataset_id:
            return ds
    return {"num_classes": 7, "num_features": 10, "num_nodes": 2708}


def _persist_explanation_to_db(db: Session, dataset_id: str, model: str, method: str, result: dict) -> None:
    """Write explanation to the explanations SQL table."""
    try:
        row = ExplanationModel(
            dataset_id=dataset_id,
            model_name=model,
            method_name=method,
            node_id=result.get("node_id", result.get("nodeId", 0)),
            predicted_class=result.get("predicted_class", result.get("predictedClass")),
            true_class=result.get("true_class", result.get("trueClass")),
            confidence=result.get("confidence"),
            subgraph_nodes=result.get("subgraph_nodes", result.get("subgraphNodes")),
            subgraph_edges=result.get("subgraph_edges", result.get("subgraphEdges")),
            feature_importance=result.get("feature_importance", result.get("featureImportance")),
            fidelity=result.get("fidelity"),
            coverage=result.get("coverage"),
        )
        db.add(row)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[explain] SQL persist failed (non-fatal): {e}")


# ── POST /api/explain ──────────────────────────────────────────────────────

@router.post("/api/explain")
async def explain(req: ExplainRequest, db: Session = Depends(get_db)):
    """
    Generate node-level explanation (subgraph, feature importance, fidelity, coverage).
    Validates node_id against dataset size.
    """
    ds_info = _get_dataset_info(req.dataset_id)
    num_nodes = ds_info.get("num_nodes", 10000)

    # Validate node_id
    if req.node_id >= num_nodes:
        raise HTTPException(
            status_code=400,
            detail=f"node_id {req.node_id} is out of range (dataset has {num_nodes} nodes, max id is {num_nodes - 1})",
        )

    # Check Redis cache
    ck = explain_cache_key(req.dataset_id, req.model.value, req.method.value, req.node_id)
    cached = cache_get(ck)
    if cached:
        return APIResponse(status="success", message="Explanation retrieved from cache", data=cached)

    # Check SQL database
    db_row = (
        db.query(ExplanationModel)
        .filter(
            ExplanationModel.dataset_id == req.dataset_id,
            ExplanationModel.model_name == req.model.value,
            ExplanationModel.method_name == req.method.value,
            ExplanationModel.node_id == req.node_id,
        )
        .first()
    )
    if db_row:
        result = {
            "node_id": db_row.node_id,
            "predicted_class": db_row.predicted_class,
            "true_class": db_row.true_class,
            "confidence": db_row.confidence,
            "subgraph_nodes": db_row.subgraph_nodes,
            "subgraph_edges": db_row.subgraph_edges,
            "feature_importance": db_row.feature_importance,
            "fidelity": db_row.fidelity,
            "coverage": db_row.coverage,
        }
        cache_set(ck, result)
        return APIResponse(status="success", message="Explanation retrieved from database", data=result)

    if MOCK_MODE:
        result = generate_explanation(
            dataset_id=req.dataset_id,
            model=req.model.value,
            method=req.method.value,
            node_id=req.node_id,
            num_classes=ds_info.get("num_classes", 7),
            num_features=min(ds_info.get("num_features", 10), 10),
        )
        cache_set(ck, result)
        _persist_explanation_to_db(db, req.dataset_id, req.model.value, req.method.value, result)
        return APIResponse(
            status="success",
            message=f"Explanation generated for node {req.node_id}",
            data=result,
        )

    # Real mode — need cached PyG data
    pyg_data = dataset_cache.get_dataset(req.dataset_id)
    if pyg_data is None:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{req.dataset_id}' not loaded for real-mode explain. Load it first.",
        )

    try:
        from services.explain_service import run_gnnexplainer

        result = run_gnnexplainer(
            dataset_id=req.dataset_id,
            model_name=req.model.value,
            method_name=req.method.value,
            node_id=req.node_id,
        )
        cache_set(ck, result)
        _persist_explanation_to_db(db, req.dataset_id, req.model.value, req.method.value, result)
        return APIResponse(
            status="success",
            message=f"Explanation generated for node {req.node_id}",
            data=result,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /api/explain-global ───────────────────────────────────────────────

@router.post("/api/explain-global")
async def explain_global(req: GlobalExplainRequest):
    """
    Generate global explainability metrics (per-class fidelity, coverage, stability).
    """
    ds_info = _get_dataset_info(req.dataset_id)

    # Check Redis cache for global explanation
    global_ck = f"explain_global:{req.dataset_id}:{req.model.value}:{req.method.value}:{req.num_samples}"
    cached = cache_get(global_ck)
    if cached:
        return APIResponse(status="success", message="Global explanation from cache", data=cached)

    if MOCK_MODE:
        result = generate_global_explanation(
            dataset_id=req.dataset_id,
            model=req.model.value,
            method=req.method.value,
            num_classes=ds_info.get("num_classes", 7),
            num_samples=req.num_samples,
        )
        cache_set(global_ck, result)
        return APIResponse(
            status="success",
            message="Global explanation generated",
            data=result,
        )

    # Real mode
    pyg_data = dataset_cache.get_dataset(req.dataset_id)
    if pyg_data is None:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{req.dataset_id}' not loaded for real-mode global explain.",
        )

    try:
        from services.explain_service import run_global_explanation

        result = run_global_explanation(
            dataset_id=req.dataset_id,
            model_name=req.model.value,
            method_name=req.method.value,
            num_samples=req.num_samples,
        )
        cache_set(global_ck, result)
        return APIResponse(
            status="success",
            message="Global explanation generated",
            data=result,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

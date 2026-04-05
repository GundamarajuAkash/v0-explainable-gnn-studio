"""
Training routes — POST /api/train, GET /api/training-status/{job_id}, GET /api/results/{dataset_id}.
Uses Redis for caching, SQL for persistence, Celery for async training.
"""

from __future__ import annotations

import os
import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from db.schemas import APIResponse, TrainRequest
from db.database import get_db
from db.models import TrainingResult as TrainingResultModel
from services.mock_service import (
    generate_benchmark_results,
    generate_training_curves,
    BUILTIN_DATASETS,
)
from services import dataset_cache
from services.redis_cache import (
    cache_get,
    cache_set,
    train_cache_key,
    train_batch_key,
    job_status_key,
)

router = APIRouter()

MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"


def _get_num_classes(dataset_id: str) -> int:
    """Resolve num_classes from cache or built-in defaults."""
    summary = dataset_cache.get_summary(dataset_id)
    if summary:
        return summary.get("num_classes", 7)
    for name, ds in BUILTIN_DATASETS.items():
        if name.lower().replace(" ", "-") == dataset_id or name == dataset_id:
            return ds["num_classes"]
    return 7


def _persist_results_to_db(
    db: Session,
    dataset_id: str,
    results: list[dict[str, Any]],
    curves: dict[str, list],
    hyperparams: dict[str, Any] | None = None,
) -> None:
    """Write each benchmark result row to the training_results SQL table."""
    for r in results:
        model_name = r.get("model", "")
        method_name = r.get("method", "")
        curve_key = f"{model_name}__{method_name}"
        curve = curves.get(curve_key, r.get("training_curve", []))

        row = TrainingResultModel(
            dataset_id=dataset_id,
            model_name=model_name,
            method_name=method_name,
            acc=r.get("ACC"),
            bacc=r.get("bACC"),
            macro_f1=r.get("MacroF1"),
            ece=r.get("ECE"),
            brier=r.get("Brier"),
            worst_recall=r.get("WorstRecall"),
            gmean=r.get("GMean"),
            per_class_metrics=r.get("per_class_metrics"),
            confusion_matrix=r.get("confusion_matrix"),
            training_curve=curve,
            hyperparams=hyperparams,
            model_path=r.get("model_path"),
        )
        db.add(row)

    db.commit()


# ── POST /api/train ────────────────────────────────────────────────────────

@router.post("/api/train")
async def train(req: TrainRequest, db: Session = Depends(get_db)):
    """
    Launch training for given models x methods on a dataset.
    In mock mode, returns results immediately and persists to SQL.
    In real mode, queues a Celery job and returns job_id.
    """
    models = [m.value for m in req.models]
    methods = [m.value for m in req.methods]
    num_classes = _get_num_classes(req.dataset_id)

    if MOCK_MODE:
        start = time.time()

        results = generate_benchmark_results(
            req.dataset_id, models, methods, num_classes
        )

        # Generate training curves for each model+method combo
        curves: dict[str, list] = {}
        for model in models:
            for method in methods:
                key = f"{model}__{method}"
                curves[key] = generate_training_curves(
                    req.dataset_id, model, method, req.epochs
                )

        duration = round(time.time() - start, 3)
        result_data = {
            "dataset_id": req.dataset_id,
            "results": results,
            "training_curves": curves,
            "duration_seconds": duration,
        }

        # Persist to SQL
        try:
            _persist_results_to_db(
                db, req.dataset_id, results, curves,
                hyperparams={
                    "epochs": req.epochs, "lr": req.lr,
                    "hidden_dim": req.hidden_dim, "dropout": req.dropout,
                    "weight_decay": req.weight_decay, "seed": req.seed,
                },
            )
        except Exception as e:
            print(f"[train] SQL persist failed (non-fatal): {e}")

        # Cache in Redis: batch result + individual results
        cache_set(train_batch_key(req.dataset_id), result_data)
        for r in results:
            ck = train_cache_key(req.dataset_id, r["model"], r["method"])
            cache_set(ck, r)

        job_id = uuid.uuid4().hex[:12]
        job_status = {
            "job_id": job_id,
            "status": "completed",
            "progress": 100.0,
            "result": result_data,
            "error": None,
        }
        cache_set(job_status_key(job_id), job_status)

        return APIResponse(
            status="success",
            message=f"Training completed ({len(results)} results)",
            data={
                "job_id": job_id,
                "status": "completed",
                "result": result_data,
            },
        )

    # Real mode — verify dataset is loaded in cache
    pyg_data = dataset_cache.get_dataset(req.dataset_id)
    if pyg_data is None:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{req.dataset_id}' not loaded. Call /api/load-builtin first.",
        )

    # Dispatch Celery task
    try:
        from workers.celery_worker import train_task

        job_id = uuid.uuid4().hex[:12]
        job_status = {
            "job_id": job_id,
            "status": "pending",
            "progress": 0.0,
            "result": None,
            "error": None,
        }
        cache_set(job_status_key(job_id), job_status)

        train_task.delay(
            job_id=job_id,
            dataset_id=req.dataset_id,
            models=models,
            methods=methods,
            epochs=req.epochs,
            lr=req.lr,
            hidden_dim=req.hidden_dim,
            dropout=req.dropout,
            weight_decay=req.weight_decay,
            seed=req.seed,
        )

        return APIResponse(
            status="success",
            message="Training job queued",
            data={"job_id": job_id, "status": "pending"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /api/training-status/{job_id} ──────────────────────────────────────

@router.get("/api/training-status/{job_id}")
async def training_status(job_id: str):
    """
    Poll training job status.
    First checks Redis for status written by Celery worker.
    Falls back to querying Celery AsyncResult directly.
    """
    # Try Redis first (written by worker on completion)
    cached = cache_get(job_status_key(job_id))
    if cached:
        return APIResponse(
            status="success",
            message=f"Job is {cached.get('status', 'unknown')}",
            data=cached,
        )

    # Fall back to Celery AsyncResult
    try:
        from workers.celery_worker import celery_app

        result = celery_app.AsyncResult(job_id)
        if result.state == "PENDING":
            data = {"job_id": job_id, "status": "pending", "progress": 0.0, "result": None, "error": None}
        elif result.state == "RUNNING":
            meta = result.info or {}
            data = {
                "job_id": job_id,
                "status": "running",
                "progress": meta.get("progress", 0.0),
                "result": None,
                "error": None,
            }
        elif result.state == "SUCCESS":
            data = result.result or {}
            data.setdefault("status", "completed")
            data.setdefault("job_id", job_id)
        elif result.state == "FAILURE":
            data = {
                "job_id": job_id,
                "status": "failed",
                "progress": 0.0,
                "result": None,
                "error": str(result.info),
            }
        else:
            data = {"job_id": job_id, "status": result.state.lower(), "progress": 0.0, "result": None, "error": None}

        return APIResponse(
            status="success",
            message=f"Job is {data.get('status', 'unknown')}",
            data=data,
        )
    except Exception:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")


# ── GET /api/results/{dataset_id} ──────────────────────────────────────────

@router.get("/api/results/{dataset_id}")
async def get_results(dataset_id: str, db: Session = Depends(get_db)):
    """
    Return benchmark results for a dataset.
    Checks Redis cache first, then falls back to SQL database.
    """
    # 1. Try Redis cache
    cached = cache_get(train_batch_key(dataset_id))
    if cached:
        return APIResponse(
            status="success",
            message="Results retrieved from cache",
            data=cached,
        )

    # 2. Fall back to SQL database
    rows = (
        db.query(TrainingResultModel)
        .filter(TrainingResultModel.dataset_id == dataset_id)
        .order_by(TrainingResultModel.created_at.desc())
        .all()
    )
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No results found for dataset '{dataset_id}'. Run training first.",
        )

    # Rebuild the batch result shape from DB rows
    results = []
    curves: dict[str, list] = {}
    for row in rows:
        r = {
            "model": row.model_name,
            "method": row.method_name,
            "ACC": row.acc,
            "bACC": row.bacc,
            "MacroF1": row.macro_f1,
            "ECE": row.ece,
            "Brier": row.brier,
            "WorstRecall": row.worst_recall,
            "GMean": row.gmean,
            "per_class_metrics": row.per_class_metrics,
            "confusion_matrix": row.confusion_matrix,
        }
        results.append(r)
        curve_key = f"{row.model_name}__{row.method_name}"
        if row.training_curve:
            curves[curve_key] = row.training_curve

    result_data = {
        "dataset_id": dataset_id,
        "results": results,
        "training_curves": curves,
        "duration_seconds": 0,
    }

    # Re-populate Redis cache from DB for next request
    cache_set(train_batch_key(dataset_id), result_data)

    return APIResponse(
        status="success",
        message=f"Results retrieved from database ({len(results)} rows)",
        data=result_data,
    )

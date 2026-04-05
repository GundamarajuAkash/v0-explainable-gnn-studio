"""
Celery worker for background training tasks.
Writes results to both Redis cache and SQL database after completion.
Requires: celery, redis running.
"""

from __future__ import annotations

import os
import time
from typing import Any

from celery import Celery

BROKER = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

celery_app = Celery("gnn_worker", broker=BROKER, backend=BACKEND)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)


def _persist_results_to_sql(
    dataset_id: str,
    results: list[dict[str, Any]],
    curves: dict[str, list],
    hyperparams: dict[str, Any],
) -> None:
    """Write all training results to the SQL database."""
    try:
        from db.database import SessionLocal
        from db.models import TrainingResult as TrainingResultModel

        db = SessionLocal()
        try:
            for r in results:
                if "error" in r:
                    continue  # skip failed combos
                model_name = r.get("model", "")
                method_name = r.get("method", "")
                curve_key = f"{model_name}__{method_name}"
                curve = curves.get(curve_key, [])

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
            print(f"[worker] Persisted {len(results)} results to SQL for dataset {dataset_id}")
        except Exception as e:
            db.rollback()
            print(f"[worker] SQL persist failed: {e}")
        finally:
            db.close()
    except Exception as e:
        print(f"[worker] Could not connect to DB for persistence: {e}")


def _cache_results_to_redis(
    job_id: str,
    dataset_id: str,
    results: list[dict[str, Any]],
    curves: dict[str, list],
    duration: float,
) -> None:
    """Write results to Redis cache so the API can serve them immediately."""
    try:
        from services.redis_cache import (
            cache_set,
            train_cache_key,
            train_batch_key,
            job_status_key,
        )

        result_data = {
            "dataset_id": dataset_id,
            "results": results,
            "training_curves": curves,
            "duration_seconds": duration,
        }

        # Cache the batch result
        cache_set(train_batch_key(dataset_id), result_data)

        # Cache each individual model+method result
        for r in results:
            if "error" not in r:
                ck = train_cache_key(dataset_id, r.get("model", ""), r.get("method", ""))
                cache_set(ck, r)

        # Update job status to completed
        job_status = {
            "job_id": job_id,
            "status": "completed",
            "progress": 100.0,
            "result": result_data,
            "error": None,
        }
        cache_set(job_status_key(job_id), job_status)

        print(f"[worker] Cached results in Redis for job {job_id}")
    except Exception as e:
        print(f"[worker] Redis caching failed (non-fatal): {e}")


def _update_job_progress(job_id: str, progress: float, status: str = "running") -> None:
    """Update job progress in Redis so the API can report it."""
    try:
        from services.redis_cache import cache_set, job_status_key

        cache_set(
            job_status_key(job_id),
            {
                "job_id": job_id,
                "status": status,
                "progress": progress,
                "result": None,
                "error": None,
            },
        )
    except Exception:
        pass


@celery_app.task(bind=True, name="train_task")
def train_task(
    self,
    job_id: str,
    dataset_id: str,
    models: list[str],
    methods: list[str],
    epochs: int = 200,
    lr: float = 0.01,
    hidden_dim: int = 64,
    dropout: float = 0.5,
    weight_decay: float = 5e-4,
    seed: int = 42,
) -> dict[str, Any]:
    """
    Background training task.
    Loads dataset, trains all model x method combos, saves models,
    persists results to SQL + Redis, and reports progress.
    """
    from services.training_service import load_pyg_dataset, train_single
    from services.svwng import train_svwng

    start = time.time()

    # Update status to running
    self.update_state(state="RUNNING", meta={"progress": 0, "job_id": job_id})
    _update_job_progress(job_id, 0.0, "running")

    # Load dataset
    dataset_map = {
        "cora": "Cora",
        "citeseer": "CiteSeer",
        "pubmed": "PubMed",
        "amazon-photo": "Amazon-Photo",
        "amazon-computers": "Amazon-Computers",
    }
    ds_name = dataset_map.get(dataset_id, dataset_id)

    try:
        data, summary = load_pyg_dataset(ds_name)
    except Exception as e:
        error_status = {
            "job_id": job_id,
            "status": "failed",
            "error": f"Failed to load dataset: {str(e)}",
        }
        try:
            from services.redis_cache import cache_set, job_status_key
            cache_set(job_status_key(job_id), {**error_status, "progress": 0.0, "result": None})
        except Exception:
            pass
        return error_status

    total = len(models) * len(methods)
    results = []
    curves = {}
    completed = 0

    for model_name in models:
        for method_name in methods:
            try:
                if method_name == "svwng":
                    result = train_svwng(
                        data, model_name,
                        dataset_id=dataset_id,
                        epochs=epochs, lr=lr, hidden_dim=hidden_dim,
                        dropout=dropout, weight_decay=weight_decay, seed=seed,
                    )
                else:
                    result = train_single(
                        data, model_name, method_name,
                        dataset_id=dataset_id,
                        epochs=epochs, lr=lr, hidden_dim=hidden_dim,
                        dropout=dropout, weight_decay=weight_decay, seed=seed,
                    )

                curve = result.pop("training_curve", [])
                model_path = result.pop("model_path", None)
                result["model_path"] = model_path  # keep for SQL
                results.append(result)
                curves[f"{model_name}__{method_name}"] = curve

            except Exception as e:
                results.append({
                    "model": model_name,
                    "method": method_name,
                    "error": str(e),
                })

            completed += 1
            progress = round(completed / total * 100, 1)
            self.update_state(
                state="RUNNING",
                meta={"progress": progress, "job_id": job_id},
            )
            _update_job_progress(job_id, progress, "running")

    duration = round(time.time() - start, 3)

    # Persist to SQL database
    hyperparams = {
        "epochs": epochs, "lr": lr, "hidden_dim": hidden_dim,
        "dropout": dropout, "weight_decay": weight_decay, "seed": seed,
    }
    _persist_results_to_sql(dataset_id, results, curves, hyperparams)

    # Cache to Redis (batch + individual + job status)
    _cache_results_to_redis(job_id, dataset_id, results, curves, duration)

    return {
        "job_id": job_id,
        "status": "completed",
        "result": {
            "dataset_id": dataset_id,
            "results": [r for r in results if "error" not in r],
            "training_curves": curves,
            "duration_seconds": duration,
        },
    }

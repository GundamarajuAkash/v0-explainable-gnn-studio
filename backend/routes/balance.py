"""
Balance preview routes.
Uses Redis for caching, SQL for persistence, dataset_cache for real PyG data.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from db.schemas import APIResponse, BalancePreviewRequest
from db.database import get_db
from db.models import BalancePreview as BalancePreviewModel
from services.mock_service import generate_balance_preview
from services import dataset_cache
from services.redis_cache import (
    cache_get,
    cache_set,
    balance_cache_key,
)

router = APIRouter()

MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"


def _persist_balance_to_db(db: Session, dataset_id: str, result: dict) -> None:
    """Write balance preview to the balance_previews SQL table."""
    try:
        row = BalancePreviewModel(
            dataset_id=dataset_id,
            method_name=result.get("method", ""),
            original_counts=result.get("original_counts"),
            balanced_counts=result.get("balanced_counts"),
            original_ir=result.get("original_ir"),
            balanced_ir=result.get("balanced_ir"),
        )
        db.add(row)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[balance] SQL persist failed (non-fatal): {e}")


@router.post("/api/balance-preview")
async def balance_preview(req: BalancePreviewRequest, db: Session = Depends(get_db)):
    """
    Preview how a balancing method transforms the class distribution.
    Returns original and balanced class counts with IR improvement.
    """
    # Check Redis cache
    ck = balance_cache_key(req.dataset_id, req.method.value)
    cached = cache_get(ck)
    if cached:
        return APIResponse(status="success", message="Balance preview from cache", data=cached)

    # Check SQL database
    db_row = (
        db.query(BalancePreviewModel)
        .filter(
            BalancePreviewModel.dataset_id == req.dataset_id,
            BalancePreviewModel.method_name == req.method.value,
        )
        .first()
    )
    if db_row:
        result = {
            "method": db_row.method_name,
            "original_counts": db_row.original_counts,
            "balanced_counts": db_row.balanced_counts,
            "original_ir": db_row.original_ir,
            "balanced_ir": db_row.balanced_ir,
            "ir_improvement": round((db_row.original_ir or 0) - (db_row.balanced_ir or 0), 2),
        }
        cache_set(ck, result)
        return APIResponse(status="success", message="Balance preview from database", data=result)

    if MOCK_MODE:
        result = generate_balance_preview(req.dataset_id, req.method.value)
        cache_set(ck, result)
        _persist_balance_to_db(db, req.dataset_id, result)
        return APIResponse(
            status="success",
            message=f"Balance preview for {req.method.value}",
            data=result,
        )

    # Real mode — compute from cached PyG data
    pyg_data = dataset_cache.get_dataset(req.dataset_id)
    if pyg_data is None:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{req.dataset_id}' not loaded. Load it first.",
        )

    try:
        from services.imbalance_methods import preview_balance_from_data

        result = preview_balance_from_data(pyg_data, req.method.value)
        cache_set(ck, result)
        _persist_balance_to_db(db, req.dataset_id, result)
        return APIResponse(
            status="success",
            message=f"Balance preview for {req.method.value}",
            data=result,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

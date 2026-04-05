"""
In-memory cache for loaded PyG Data objects and their summaries.
Shared by datasets, train, explain, and balance routes.
"""

from __future__ import annotations

from typing import Any, Optional

from torch_geometric.data import Data


# dataset_id -> {"data": Data, "summary": dict}
_loaded: dict[str, dict[str, Any]] = {}

# dataset_id -> summary-dict only (for mock-mode / before real loading)
_summaries: dict[str, dict[str, Any]] = {}


# ── PyG Data cache ──────────────────────────────────────────────────────────

def store_dataset(dataset_id: str, data: Data, summary: dict[str, Any]) -> None:
    """Cache a loaded PyG dataset and its summary."""
    _loaded[dataset_id] = {"data": data, "summary": summary}
    _summaries[dataset_id] = summary


def get_dataset(dataset_id: str) -> Optional[Data]:
    """Return the cached PyG Data object, or None."""
    entry = _loaded.get(dataset_id)
    return entry["data"] if entry else None


def get_summary(dataset_id: str) -> Optional[dict[str, Any]]:
    """Return the cached summary dict, or None."""
    return _summaries.get(dataset_id)


def has_dataset(dataset_id: str) -> bool:
    return dataset_id in _loaded


# ── Summary-only cache (mock mode) ─────────────────────────────────────────

def store_summary(dataset_id: str, summary: dict[str, Any]) -> None:
    """Store a summary without a PyG object (mock mode or upload)."""
    _summaries[dataset_id] = summary


def list_summaries() -> list[dict[str, Any]]:
    """Return all cached summaries."""
    return list(_summaries.values())


def count() -> int:
    return len(_summaries)

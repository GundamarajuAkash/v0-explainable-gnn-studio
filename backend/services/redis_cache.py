"""
Redis cache helper — provides get/set with JSON serialization.
Falls back to in-memory dict when Redis is unavailable.
"""

from __future__ import annotations

import json
import os
from typing import Any, Optional

REDIS_URL = os.getenv("REDIS_URL", os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"))

# Default TTL: 24 hours
DEFAULT_TTL = int(os.getenv("CACHE_TTL_SECONDS", "86400"))

_redis_client = None
_redis_available = False
_fallback: dict[str, str] = {}


def _get_redis():
    """Lazily connect to Redis. Returns None if unavailable."""
    global _redis_client, _redis_available
    if _redis_client is not None:
        return _redis_client if _redis_available else None
    try:
        import redis as redis_lib

        _redis_client = redis_lib.Redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
        )
        _redis_client.ping()
        _redis_available = True
        print("[cache] Connected to Redis at", REDIS_URL)
        return _redis_client
    except Exception as e:
        _redis_available = False
        _redis_client = object()  # sentinel so we don't retry every call
        print(f"[cache] Redis unavailable ({e}), using in-memory fallback")
        return None


# ── Public API ──────────────────────────────────────────────────────────────

def cache_get(key: str) -> Optional[dict[str, Any]]:
    """Retrieve a cached value. Returns None on miss."""
    r = _get_redis()
    if r is not None:
        try:
            raw = r.get(key)
            if raw is not None:
                return json.loads(raw)
        except Exception:
            pass
    else:
        raw = _fallback.get(key)
        if raw is not None:
            return json.loads(raw)
    return None


def cache_set(key: str, value: Any, ttl: int = DEFAULT_TTL) -> None:
    """Store a value in cache with TTL."""
    raw = json.dumps(value, default=str)
    r = _get_redis()
    if r is not None:
        try:
            r.setex(key, ttl, raw)
            return
        except Exception:
            pass
    _fallback[key] = raw


def cache_delete(key: str) -> None:
    """Delete a key from cache."""
    r = _get_redis()
    if r is not None:
        try:
            r.delete(key)
            return
        except Exception:
            pass
    _fallback.pop(key, None)


def cache_keys(pattern: str) -> list[str]:
    """List keys matching a glob pattern (e.g. 'train:cora:*')."""
    r = _get_redis()
    if r is not None:
        try:
            return [k for k in r.scan_iter(match=pattern, count=500)]
        except Exception:
            pass
    # Fallback: simple prefix match
    import fnmatch

    return [k for k in _fallback if fnmatch.fnmatch(k, pattern)]


# ── Cache key helpers ───────────────────────────────────────────────────────

def train_cache_key(dataset_id: str, model: str, method: str) -> str:
    return f"train:{dataset_id}:{model}:{method}"


def train_batch_key(dataset_id: str) -> str:
    return f"train_batch:{dataset_id}"


def explain_cache_key(dataset_id: str, model: str, method: str, node_id: int) -> str:
    return f"explain:{dataset_id}:{model}:{method}:{node_id}"


def balance_cache_key(dataset_id: str, method: str) -> str:
    return f"balance:{dataset_id}:{method}"


def job_status_key(job_id: str) -> str:
    return f"job:{job_id}"

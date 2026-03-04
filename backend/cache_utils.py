"""
Simple in-memory TTL cache for API responses.
Key format: optional prefix + path + sorted query string.
"""
import time
from typing import Any, Optional

_cache: dict[str, tuple[float, Any]] = {}
_DEFAULT_TTL = 300  # 5 minutes for public data
_DASHBOARD_TTL = 120  # 2 minutes for dashboard


def _make_key(prefix: str, path: str, query: Optional[dict] = None) -> str:
    if not query:
        return f"{prefix}:{path}"
    q = "&".join(f"{k}={v}" for k, v in sorted(query.items()) if v is not None)
    return f"{prefix}:{path}?{q}"


def get_cached(key: str) -> Optional[Any]:
    now = time.time()
    if key in _cache:
        expiry, value = _cache[key]
        if now < expiry:
            return value
        del _cache[key]
    return None


def set_cached(key: str, value: Any, ttl_seconds: int = _DEFAULT_TTL) -> None:
    _cache[key] = (time.time() + ttl_seconds, value)


def invalidate_pattern(prefix: str) -> None:
    """Remove all keys starting with prefix (e.g. 'public/doctors' or 'public/companies')."""
    to_del = [k for k in _cache if k.startswith(prefix)]
    for k in to_del:
        del _cache[k]

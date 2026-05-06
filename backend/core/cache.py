"""
In-memory TTL cache helpers for high-frequency read endpoints.

Usage:
    from core.cache import response_cache

    @router.get("/stats")
    def my_endpoint(db: Session = Depends(get_db)):
        with response_cache("my_endpoint", ttl=5) as cached:
            if cached.hit:
                return cached.value
            result = _compute(db)
            cached.store(result)
            return result
"""
import time
import threading
from functools import wraps
from typing import Any  # noqa: F401

_lock = threading.Lock()
_store: dict[str, tuple[float, Any]] = {}


def _cached_get(key: str, ttl: float) -> tuple[bool, Any]:
    """Return (hit, value). Thread-safe."""
    with _lock:
        if key in _store:
            ts, val = _store[key]
            if time.monotonic() - ts < ttl:
                return True, val
    return False, None


def _cached_set(key: str, value: Any) -> None:
    with _lock:
        _store[key] = (time.monotonic(), value)


class _CacheContext:
    """Context manager returned by response_cache()."""
    def __init__(self, key: str, ttl: float):
        self._key = key
        self._ttl = ttl
        self.hit = False
        self.value = None

    def __enter__(self):
        self.hit, self.value = _cached_get(self._key, self._ttl)
        return self

    def __exit__(self, *_):
        pass

    def store(self, value: Any) -> None:
        """Persist a freshly computed value into the cache."""
        _cached_set(self._key, value)
        self.value = value


def response_cache(key: str, ttl: float = 5.0):
    """
    Lightweight context-manager cache.

    Example::

        with response_cache("parking_stats", ttl=5) as c:
            if c.hit:
                return c.value
            data = expensive_query()
            c.store(data)
            return data
    """
    return _CacheContext(key, ttl)


# ── Legacy decorator (kept for backward compatibility with analytics.py) ──────
def timed_cache(seconds: int = 5):
    """
    Simple function-level cache decorator with TTL.
    NOTE: Not safe for functions with dependency-injected args (different db
    sessions will be ignored – cache key is function name only). Use
    response_cache() context manager for FastAPI endpoints instead.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            hit, val = _cached_get(func.__name__, float(seconds))
            if hit:
                return val
            result = func(*args, **kwargs)
            _cached_set(func.__name__, result)
            return result
        return wrapper
    return decorator

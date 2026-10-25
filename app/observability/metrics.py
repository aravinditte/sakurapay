"""In-process metrics counters for SakuraPay.

Deliberately minimal: a module-level dictionary of named integer counters,
guarded by a lock so API and worker threads in the same process can update
them safely. Counters are process-local and reset on restart — they are a
diagnostics aid, not a monitoring system. For durable metrics, export
``snapshot()`` to your platform of choice.

Usage:
    from app.observability import metrics
    metrics.increment("payments.captured")
    metrics.increment("webhooks.retries", by=2)
    current = metrics.snapshot()   # returns a copy: {name: count, ...}
"""

import threading

_lock = threading.Lock()
_counters: dict[str, int] = {}


def increment(name: str, by: int = 1) -> int:
    """Increment counter ``name`` by ``by`` (default 1) and return its new value.

    The counter is created at 0 if it does not exist yet.
    """
    with _lock:
        _counters[name] = _counters.get(name, 0) + by
        return _counters[name]


def get(name: str) -> int:
    """Return the current value of counter ``name`` (0 if it was never incremented)."""
    with _lock:
        return _counters.get(name, 0)


def snapshot() -> dict[str, int]:
    """Return a copy of all counters as ``{name: count}``.

    Mutating the returned dict does not affect the internal state.
    """
    with _lock:
        return dict(_counters)


def reset() -> None:
    """Clear all counters. Intended for tests and controlled restarts."""
    with _lock:
        _counters.clear()

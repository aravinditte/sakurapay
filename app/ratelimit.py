import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    """In-process sliding-window limiter. NOTE: per-process only; a multi-worker production deployment needs a shared store. Limits are a demo-grade abuse brake, not a distributed control."""

    def __init__(self):
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key, limit_per_minute):
        now = time.time()
        window = now - 60
        with self._lock:
            q = self._hits[key]
            while q and q[0] < window:
                q.popleft()
            if len(q) >= limit_per_minute:
                return False
            q.append(now)
            return True


limiter = RateLimiter()

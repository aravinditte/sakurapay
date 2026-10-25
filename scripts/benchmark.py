"""SakuraPay local benchmark (spec section 18): measures create/authorize/capture/refund/replay
latency and throughput with the FastAPI TestClient against a throwaway database.
Writes a Markdown results file with environment details. Numbers are LOCAL results only.
Usage: python scripts/benchmark.py [--iterations 200] [--out benchmarks/results-local.md]
"""

import argparse
import os
import platform
import sys
import tempfile
import time

os.environ.setdefault("DATABASE_URL", "sqlite:///" + tempfile.mktemp(suffix=".db"))
os.environ.setdefault("JWT_SECRET_KEY", "benchmark-secret-0123456789abcdef")
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "1000000")
os.environ.setdefault("AUTH_RATE_LIMIT_PER_MINUTE", "1000000")
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "1000000")
os.environ.setdefault("AUTH_RATE_LIMIT_PER_MINUTE", "1000000")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient


def pct(vals, q):
    vals = sorted(vals)
    return vals[min(len(vals) - 1, int(q * len(vals)))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--iterations", type=int, default=200)
    ap.add_argument("--out", default="")
    args = ap.parse_args()
    from app.main import app

    c = TestClient(app)
    r = c.post(
        "/api/v1/auth/register",
        json={"email": "bench@example.test", "password": "demo-password", "merchant_name": "Bench"},
    )
    H = {"Authorization": f"Bearer {r.json()['access_token']}"}
    lat = {"create": [], "authorize": [], "capture": [], "refund": [], "replay": []}
    start = time.time()
    for i in range(args.iterations):
        t = time.time()
        p = c.post(
            "/api/v1/payments",
            json={"amount_minor": 10000, "currency": "USD", "customer_reference": "bench"},
            headers={**H, "Idempotency-Key": f"b-create-{i}"},
        )
        lat["create"].append(time.time() - t)
        pid = p.json()["id"]
        t = time.time()
        c.post(
            f"/api/v1/payments/{pid}/authorize", json={"simulation_outcome": "APPROVED"}, headers=H
        )
        lat["authorize"].append(time.time() - t)
        t = time.time()
        c.post(
            f"/api/v1/payments/{pid}/capture",
            json={"amount_minor": 10000},
            headers={**H, "Idempotency-Key": f"b-cap-{i}"},
        )
        lat["capture"].append(time.time() - t)
        t = time.time()
        c.post(
            f"/api/v1/payments/{pid}/capture",
            json={"amount_minor": 10000},
            headers={**H, "Idempotency-Key": f"b-cap-{i}"},
        )
        lat["replay"].append(time.time() - t)
        t = time.time()
        c.post(
            f"/api/v1/payments/{pid}/refunds",
            json={"amount_minor": 1000},
            headers={**H, "Idempotency-Key": f"b-ref-{i}"},
        )
        lat["refund"].append(time.time() - t)
    dur = time.time() - start
    total_ops = sum(len(v) for v in lat.values())
    lines = [
        f"# Benchmark results (local, {time.strftime('%Y-%m-%d')})",
        "",
        f"Environment: Python {platform.python_version()}, {platform.system()} {platform.machine()}, SQLite throwaway DB, FastAPI TestClient (in-process, no network). Iterations: {args.iterations} full payment cycles.",
        "",
        "| Operation | p50 ms | p95 ms | p99 ms |",
        "|---|---:|---:|---:|",
    ]
    for k, v in lat.items():
        lines.append(
            f"| {k} | {pct(v, 0.5) * 1000:.1f} | {pct(v, 0.95) * 1000:.1f} | {pct(v, 0.99) * 1000:.1f} |"
        )
    lines += [
        "",
        f"Total: {total_ops} operations in {dur:.1f}s = {total_ops / dur:.1f} ops/s (in-process; not comparable to networked HTTP benchmarks).",
        "",
        "Limitations: in-process TestClient, SQLite, single machine, no PostgreSQL, no network latency. See docs/benchmark-methodology.md.",
    ]
    out = "\n".join(lines) + "\n"
    print(out)
    if args.out:
        with open(args.out, "w") as fh:
            fh.write(out)
        print("written to", args.out)


if __name__ == "__main__":
    main()

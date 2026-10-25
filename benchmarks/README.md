# Benchmarks

Two tools are provided. Neither publishes numbers by itself — any figure you quote must follow `docs/benchmark-methodology.md` (environment, commit, workload, warm-up, repeated trials, error rates, limitations). **No benchmark results have been published for this project yet, and none may be invented.**

## 1. `scripts/benchmark.py` — in-process latency snapshot

Measures end-to-end operation latency inside one process using FastAPI's `TestClient` (no network, no separate server). It exercises:

- **Create** — `POST /api/v1/payments`
- **Capture** — authorize + `POST /api/v1/payments/{id}/capture`
- **Refund** — `POST /api/v1/payments/{id}/refunds`
- **Replay** — repeating a capture with the same idempotency key (stored-response path)

Operations run **threaded** (configurable worker count) so contention effects are at least visible. For each operation it reports count, error count, and p50 / p95 / p99 latency plus mean throughput over the measured window.

Run it from the project root:

```bash
python scripts/benchmark.py
```

Notes and limits:

- The database defaults to the configured `DATABASE_URL`; for meaningful numbers point it at PostgreSQL, not the SQLite demo file.
- TestClient runs in-process, so these numbers exclude real HTTP, TLS, and network overhead. Treat them as a *relative* regression signal (commit A vs commit B on the same machine), never as production throughput.
- Discard the first (warm-up) portion of any serious run, per the methodology doc.

## 2. `benchmarks/locustfile.py` — HTTP load test

Drives a real running server over HTTP with Locust.

```bash
# terminal 1: the app (PostgreSQL recommended)
uvicorn app.main:app --host 127.0.0.1 --port 8000

# terminal 2: the load test
locust -f benchmarks/locustfile.py --host http://127.0.0.1:8000
```

Open the Locust UI (default http://127.0.0.1:8089), choose the user count and spawn rate for the scenario you are measuring, and record — alongside the results — the full environment block required by `docs/benchmark-methodology.md` (hardware, OS, Python and PostgreSQL versions, commit hash, request mix, dataset size, concurrency, duration).

## Reporting results

Save raw output with the run, state the commit it was measured at, and report successful throughput **together with** the error rate. Local results and hosted results are reported separately and never blended.

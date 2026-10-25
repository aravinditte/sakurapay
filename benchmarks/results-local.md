# Benchmark results (local, 2026-10-24)

Environment: Python 3.12.3, Linux x86_64, SQLite throwaway DB, FastAPI TestClient (in-process, no network). Iterations: 200 full payment cycles.

| Operation | p50 ms | p95 ms | p99 ms |
|---|---:|---:|---:|
| create | 10.9 | 18.5 | 27.9 |
| authorize | 10.9 | 17.4 | 30.7 |
| capture | 15.2 | 26.5 | 57.1 |
| refund | 15.6 | 25.2 | 33.0 |
| replay | 8.4 | 14.0 | 26.6 |

Total: 1000 operations in 13.5s = 74.1 ops/s (in-process; not comparable to networked HTTP benchmarks).

Limitations: in-process TestClient, SQLite, single machine, no PostgreSQL, no network latency. See docs/benchmark-methodology.md.

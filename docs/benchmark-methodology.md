# Benchmark Methodology

SakuraPay publishes **no performance numbers that were not measured under this methodology**. There are currently no published benchmark results for this project; the scripts exist (`benchmarks/locustfile.py`, `scripts/benchmark.py`) and results may only be quoted after a run that follows this document (spec §18).

## Scenarios to measure

- Payment creation throughput.
- Capture latency.
- Refund latency.
- Same-key idempotent replay latency.
- Concurrent refund contention on a single payment.
- Database connection-pool saturation.
- Webhook queue processing rate.
- Reconciliation runtime over increasing record counts.

## Metrics to record

Requests per second; p50 / p95 / p99 latency; error rate; timeout rate; database connection usage; lock waits and deadlocks observed; worker queue depth; webhook retry counts; CPU and memory utilization.

## Required experimental method (spec §18.3)

For every published benchmark, record **all** of the following — a result missing any item is not publishable:

1. **Environment:** hardware (CPU, RAM), operating system, Python version, PostgreSQL version, and relevant configuration (pool sizes, worker counts).
2. **Commit:** the exact git commit hash of the code measured.
3. **Workload:** the request mix (relative weights of each scenario), the dataset size (pre-seeded payments/accounts), and the payload shapes used.
4. **Load shape:** concurrency level(s), ramp behaviour, and total test duration for each scenario.
5. **Warm-up:** a consistent warm-up period before measurement, stated in the report. Discard warm-up samples.
6. **Trials:** repeated trials (not a single run); report each trial or the median across trials, and say which.
7. **Errors alongside speed:** report successful throughput **and** error/timeout rates for the same window. A throughput figure without its error rate is invalid.
8. **Local vs hosted:** distinguish local-machine results from any public-hosting results; never blend them.
9. **Artifacts:** include the benchmark script version and the raw output with the report.
10. **Limitations:** state known sources of measurement error (shared machine noise, SQLite vs PostgreSQL, in-process TestClient vs real HTTP, clock granularity) and any deviations from this methodology.

## Rules for claims

- A valid claim reads: *"Under the documented local workload, the implementation achieved the measured throughput and latency reported in the accompanying benchmark results."*
- Never claim a percentage improvement without a baseline measured under identical conditions (same environment, workload, and commit lineage).
- SQLite results demonstrate functional behaviour only; throughput and concurrency numbers are meaningful only against PostgreSQL.
- Numbers from a debug build, a warm cache that production would not have, or a run with errors suppressed must not be quoted.

## How to run

- Quick in-process latency snapshot (TestClient, threaded; indicative only, not publishable as throughput): `python scripts/benchmark.py`.
- HTTP load against a running server: `locust -f benchmarks/locustfile.py --host http://127.0.0.1:8000` (see `benchmarks/README.md`).
- Record the environment block above in the results file before starting the run, not from memory afterwards.

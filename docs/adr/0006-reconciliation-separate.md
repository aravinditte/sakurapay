# ADR — Reconciliation as a separate, read-only process

Status: Accepted (v1 implementation)

**Context.** Checks written into the same code path that performs an operation tend to share that path's bugs: if the write logic miscomputes a balance, a check computed the same way will agree with it.

**Decision.** Implement reconciliation as a separate engine (`app/services/reconciliation_service.py`, admin-triggered) that independently re-derives facts from stored records — re-summing ledger entries, recomputing balances from the ledger, comparing refund totals to captured amounts, and verifying capture postings exist — and stores discrepancies on a run record. Reconciliation is read-only by default; it reports, it never repairs.

**Consequences.** Discrepancies (including deliberately injected test fixtures) are detected even when the write path is at fault. Repairs remain explicit, authorized, auditable operations. The engine's coverage is incremental: checks present today are balanced entries, balance-vs-ledger comparison, over-refund detection, missing capture postings, and exhausted webhook surfacing.

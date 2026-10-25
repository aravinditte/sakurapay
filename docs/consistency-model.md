# Consistency Model

SakuraPay is a modular monolith in which **the database is the source of truth** for committed financial operations. Consistency comes from database transactions, uniqueness constraints, and row locking — not from in-process state — so guarantees hold across concurrent requests, multiple workers, and restarts.

## Transaction boundaries

Every operation that changes financial state executes as **one database transaction**: either all of its records commit together or none of them do. There is never a committed state change with its ledger posting missing.

A successful **capture** is the canonical example. In one transaction it:

1. Locks the payment row (`SELECT ... FOR UPDATE` on PostgreSQL; the same code path degrades to a plain read on SQLite, which is why concurrency claims require PostgreSQL).
2. Verifies the payment is in `AUTHORIZED` state and the capture amount equals the authorized amount (v1 has no partial capture).
3. Creates the ledger transaction and its balanced signed entries (customer funding −amount, merchant payable +amount).
4. Applies the same deltas to the materialized account balances, locking accounts in deterministic (sorted-by-ID) order to reduce deadlock risk.
5. Updates the payment state to `CAPTURED` and records the `payment_operations` history row.
6. Writes an audit record.
7. Inserts the `payment.captured.v1` outbox event.
8. Completes the idempotency record with the response that will be replayed on retries.
9. Commits — atomically.

Refunds follow the same pattern: lock the payment, verify `amount <= captured - refunded_so_far`, insert the refund, post the compensating ledger transaction, update totals and state, audit, outbox, commit. Authorization changes state and writes history/outbox/audit but posts no ledger entries (no money moves until capture).

No external HTTP call is made while a transaction is open. The mock provider is deterministic and in-process; webhook delivery happens later, from committed outbox rows.

## Source-of-truth rules

- **Payment records** describe lifecycle state.
- **Ledger entries** describe financial movements and are the auditable record; posted entries are never edited or deleted through ordinary paths — corrections use compensating transactions.
- **Materialized balances** (`accounts.balance_minor`) are derived state, updated transactionally with the ledger and independently checkable against it.
- **Outbox events** describe notifications that owe delivery; if an event row exists, delivery will eventually be attempted.
- **Webhook delivery records** describe notification attempts and their outcomes.
- **Audit logs** describe significant actions and their actors.
- **Reconciliation** compares these records read-only and reports discrepancies; it never silently overwrites a balance.

## Idempotency model

Idempotent operations (`create_payment`, `capture`, `refund`) carry a client-supplied `Idempotency-Key`, scoped per `(merchant_id, key, scope)`:

1. The semantically relevant request fields are canonicalized and hashed with SHA-256.
2. The key is registered in the database inside the operation's transaction; the unique constraint serializes concurrent duplicates.
3. Same key + same hash + completed → the **stored response is replayed**; no second effect.
4. Same key + different hash → `409 IDEMPOTENCY_KEY_REUSED`.
5. Same key while the first request is still `PROCESSING` → `409 IDEMPOTENCY_IN_PROGRESS`.
6. If the operation's transaction rolls back, the idempotency record rolls back with it — a retry after a crash is free to execute exactly once.

Losing a response after commit is therefore safe: the client's retry returns the committed result.

## Webhook delivery semantics: at least once

Delivery is **at least once, never claimed as exactly once**. A receiver may process an event and the sender may still record a failure (crash, timeout after the receiver committed), so duplicates are possible by design. The contract that makes this safe:

- Every event has a stable ID, sent as `X-SakuraPay-Event-Id`; receivers must deduplicate on it.
- Deliveries are HMAC-SHA256 signed (`timestamp + "." + raw body`), verified with constant-time comparison.
- Failed deliveries retry with bounded backoff (approximately 5s, 15s, 45s, 120s; max attempts configurable, default 5) and then become `EXHAUSTED`, visible for manual inspection and operator-triggered retry.
- The transactional outbox guarantees the *intent* to notify is as durable as the state change itself: a worker crash after commit cannot lose the event, and a restarted worker resumes from committed rows.

## Invariants (continuously checkable)

1. Every posted ledger transaction's signed entries sum to zero, with at least two entries in one currency.
2. Cumulative successful refunds never exceed the captured amount.
3. A payment is captured at most once; a logical operation is posted at most once.
4. Materialized balances equal ledger-derived balances.
5. Every committed capture has exactly one capture posting and an outbox event.

The reconciliation engine (see ADR-0006) verifies 1, 2, 4, and the capture-posting part of 5 independently of the write path.

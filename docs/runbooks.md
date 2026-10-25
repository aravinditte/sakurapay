# Operational Runbooks

How to investigate the failures SakuraPay is designed to survive. General rules for every incident: work from records (payment, ledger, outbox, delivery, audit) before changing anything; prefer the API's audited operations over direct database writes; never edit or delete posted ledger entries — corrections are compensating transactions.

## 1. Repeated webhook failures

- **Detection:** Deliveries accumulating in `PENDING` with growing `attempts`, or `EXHAUSTED` deliveries; reconciliation reports surface exhausted deliveries (`WEBHOOK_EXHAUSTED`).
- **Investigation:** `GET /api/v1/webhook-deliveries` — check `last_status_code` and `last_error` per delivery. Group by endpoint: one endpoint failing is a receiver problem; all endpoints failing suggests worker, network, or DNS trouble. Verify the receiver is up and that its clock is sane (signature checks are timestamp-sensitive).
- **Safe recovery:** Fix the receiver first. Then use `POST /api/v1/webhook-deliveries/{id}/retry` (audited) to reschedule. Confirm the delivery reaches `SUCCEEDED` and the receiver deduplicated by event ID.
- **Prohibited:** Deleting delivery or outbox rows; marking deliveries succeeded by hand; resending with a modified payload (signature covers the exact bytes).

## 2. Stuck pending operations

- **Detection:** Payments lingering in `CREATED`/`AUTHORIZED`, idempotency records stuck in `PROCESSING`, outbox events with `published_at` still null long after commit.
- **Investigation:** Check `payment_operations` for the attempt history and `failure_code`. A `PROCESSING` idempotency record whose request is no longer running indicates a crash mid-operation; check whether the business effect committed (payment state + ledger) before deciding anything. Unpublished outbox rows mean the worker is down or behind (see §8).
- **Safe recovery:** If the effect did not commit, the client may safely retry with the **same** idempotency key. If it did commit, a retry with the same key returns the stored result. Restart the worker for unpublished outbox rows — delivery resumes from committed state.
- **Prohibited:** Forcing a payment's status with raw SQL; deleting a `PROCESSING` idempotency record while its request may still be running; re-executing an operation under a *new* key to "unstick" it (creates the duplicate the system exists to prevent).

## 3. PostgreSQL deadlocks

- **Detection:** Intermittent `409`/500s under load, PostgreSQL log lines about deadlocks, transactions rolled back with serialization/deadlock errors.
- **Investigation:** Identify the operation pair involved (captures and refunds on the same payment are the usual contenders). The codebase locks accounts in deterministic sorted order and payments by row; a new code path that locks in a different order is the prime suspect.
- **Safe recovery:** Deadlock victims are rolled back atomically — the client retrying with the same idempotency key is the designed recovery. If deadlocks persist, reduce concurrency on the hot payment and fix the lock ordering in code.
- **Prohibited:** Disabling transactions or row locks to "make it faster"; retry loops without idempotency keys; holding a transaction open across an HTTP call.

## 4. Database connection exhaustion

- **Detection:** Requests timing out waiting for a connection, pool errors in logs, PostgreSQL `too many clients`, worker and API both stalling.
- **Investigation:** Compare configured pool sizes (API + worker + admin tools) against PostgreSQL `max_connections`. Look for leaked sessions (long-lived idle-in-transaction connections) and runaway background jobs.
- **Safe recovery:** Restart the offending process to release its pool; lower per-process pool sizes or add a pooler for multi-process deployments; kill genuinely idle-in-transaction sessions after confirming they hold no uncommitted financial work.
- **Prohibited:** Raising `max_connections` blindly without accounting for per-connection memory; restarting PostgreSQL as a first resort while transactions are in flight.

## 5. Ledger discrepancies

- **Detection:** A reconciliation run reports `LEDGER_UNBALANCED`, `BALANCE_MISMATCH`, `OVER_REFUND`, or `MISSING_CAPTURE_LEDGER`.
- **Investigation:** Open the run's discrepancy list; each item names the affected resource ID. Compare the ledger transaction's entries, the materialized balance, and the ledger-derived balance for that account. Use audit logs to reconstruct which operations touched the resource. Deliberately injected test fixtures are the expected cause in demo data — confirm provenance before treating it as an incident.
- **Safe recovery:** Report and investigate; correct genuine errors only with an explicit, authorized, audited compensating transaction. Re-run reconciliation to confirm the discrepancy set changes exactly as intended.
- **Prohibited:** Editing or deleting ledger entries; overwriting a materialized balance to match (that destroys the evidence reconciliation exists to surface); closing a discrepancy without a linked investigation note.

## 6. Duplicate idempotency conflicts

- **Detection:** Spikes in `409 IDEMPOTENCY_KEY_REUSED` or `IDEMPOTENCY_IN_PROGRESS` responses for one merchant.
- **Investigation:** `IDEMPOTENCY_KEY_REUSED` means the same key arrived with a **different payload hash** — usually a client bug (key generated per order but reused after editing the order, or a key derived from something mutable). `IN_PROGRESS` spikes mean slow originals or a crashed worker process. Inspect the stored `request_hash` and the client's key-generation logic.
- **Safe recovery:** Coach the client to mint one key per logical operation and reuse it byte-for-byte on retries. No server-side cleanup is needed for completed records; they expire per the retention policy.
- **Prohibited:** Deleting idempotency records to "let the retry through"; accepting the same key with a different payload (that silently changes the meaning of a committed operation).

## 7. Failed schema migrations

- **Detection:** Deployment step fails during `alembic upgrade head`, the app fails its readiness check, or startup errors reference missing columns/tables.
- **Investigation:** Read the Alembic output and current revision (`alembic current`) before retrying. Determine whether the migration partially applied (DDL is transactional in PostgreSQL for most operations, but verify). Check the migration against the models in `app/infrastructure/models.py`.
- **Safe recovery:** Fix the migration, or `alembic downgrade` to the last good revision if the upgrade left a half-applied state, then re-run. Restore from the pre-deploy backup if data was damaged. Verify `/health/ready` and a smoke payment before reopening traffic.
- **Prohibited:** Editing the schema by hand to match the app while leaving Alembic's revision table behind; stamping a revision (`alembic stamp`) without verifying the schema actually matches it; deploying app code that expects the new schema before the migration succeeds.

## 8. Worker crashes and restarts

- **Detection:** Outbox events stop being published (`published_at` stays null), delivery attempts freeze, worker process absent; health signals show a stale last-successful poll.
- **Investigation:** Worker logs around the crash time; check for a poison event (one malformed payload repeatedly failing) versus infrastructure loss (DB unreachable). Confirm which deliveries were mid-attempt — an attempt interrupted after the receiver responded is indistinguishable from a failure and will simply retry (at-least-once semantics make this safe).
- **Safe recovery:** Restart the worker (`python -m app.workers.main`). It resumes from committed outbox/delivery rows; nothing needs to be replayed by hand. Watch the pending queue drain and spot-check that receivers deduplicated any redeliveries by event ID.
- **Prohibited:** Manually inserting delivery rows or marking outbox events published to "catch up"; running two workers against the same database without confirming delivery-record uniqueness is respected (the `(event_id, endpoint_id)` constraint protects creation, but do not test it in production by accident).

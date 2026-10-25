# Database Design

SakuraPay uses SQLAlchemy 2.x models (`app/infrastructure/models.py`) against PostgreSQL in production-style use, with SQLite as the zero-setup local demo default. All externally visible IDs are UUID strings (`String(36)`, generated in the application). All timestamps are timezone-aware UTC.

## Money representation

All monetary values are **integer minor units** (`BigInteger`, e.g. `amount_minor`, `balance_minor`, `amount_delta_minor`) with the ISO 4217 currency stored separately as `String(3)`. Floating point is never used for money. No currency conversion exists; supported currencies are USD (primary) and JPY (Yen).

## Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| id | String(36) PK | UUID |
| email | String(320), unique, indexed, not null | Login identity |
| password_hash | Text, not null | Argon2id hash only — never plaintext |
| role | String(32) | `ADMIN`, `MERCHANT`, `OPERATOR` (default `MERCHANT`) |
| is_active | Boolean | Default true |
| created_at / updated_at | DateTime(tz) | |

### `merchants`
`id` PK · `owner_user_id` FK -> `users.id` · `name` String(160) · `status` String(24) (`ACTIVE`/`SUSPENDED`, default `ACTIVE`) · `created_at`.
A merchant sees only its own payments and resources; ownership is enforced in the service layer on every lookup.

### `accounts`
`id` PK · `owner_type` String(24) (customer / merchant / system) · `owner_id` String(36) (polymorphic — validated in the application layer) · `currency` String(3) · `account_type` String(32) (e.g. `FUNDING`, `PAYABLE`) · `balance_minor` BigInteger (materialized signed balance) · `status` · `created_at`.
**Unique constraint `uq_account_owner` on `(owner_type, owner_id, currency, account_type)`** — one account per owner/currency/type, which makes `get_or_create_account` safe to call inside a transaction.

### `payments`
`id` PK · `merchant_id` FK -> `merchants.id`, indexed · `customer_reference` String(128), optional · `amount_minor` BigInteger, not null · `currency` String(3) · `status` String(32) (state machine state, default `CREATED`) · `description` String(500) · `metadata` JSON · `captured_amount_minor` / `refunded_amount_minor` BigInteger running totals used by the refund cap · `version` Integer optimistic counter · `created_at` / `updated_at`.

### `payment_operations`
Append-only attempt history: `id` PK · `payment_id` FK -> `payments.id` · `operation_type` (`AUTHORIZE`/`CAPTURE`) · `amount_minor` · `status` (`PENDING`/`SUCCEEDED`/`FAILED`) · `provider_reference` (simulator-generated) · `failure_code` · `created_at` / `completed_at`. Earlier attempts are never overwritten.

### `refunds`
`id` PK · `payment_id` FK -> `payments.id`, indexed · `amount_minor` BigInteger · `reason` String(256) · `status` · `created_by` FK -> `users.id` · `created_at` / `completed_at`. The refund cap is enforced by locking the parent payment row and comparing against `captured_amount_minor - refunded_amount_minor` inside the same transaction.

### `ledger_transactions`
One logical financial event: `id` PK · `transaction_type` (`CAPTURE`/`REFUND`) · `reference_type` (`payment`/`refund`) · `reference_id` · `currency` · `status` (default `POSTED`) · `created_at`.
**Unique constraint `uq_ledger_ref` on `(transaction_type, reference_type, reference_id)`** — the same logical operation can never be posted twice, even under retries or races.

### `ledger_entries`
`id` PK · `ledger_transaction_id` FK -> `ledger_transactions.id` · `account_id` FK -> `accounts.id` · `amount_delta_minor` BigInteger (signed) · `created_at`.
Entries are append-only through ordinary application paths: there is no update or delete endpoint or service method for posted entries. Corrections are made with a new compensating transaction, never by editing history.

### `idempotency_keys`
`id` PK · `merchant_id` FK -> `merchants.id` · `key` String(255) · `scope` String(64) (operation scope, e.g. `create_payment`, `capture`, `refund`) · `request_hash` String(64) (SHA-256 of the canonical request) · `response_status` / `response_body` JSON (the stored response, replayed verbatim) · `resource_id` · `state` (`PROCESSING`/`COMPLETED`) · `created_at` / `expires_at`.
**Unique constraint `uq_idem` on `(merchant_id, key, scope)`** — correctness is enforced by the database, not by in-process locks, so it holds across multiple application workers and restarts.

### `webhook_endpoints`
`id` PK · `merchant_id` FK -> `merchants.id` · `url` Text · `signing_secret` Text (generated with `secrets.token_hex(32)`, returned once at creation, never logged) · `is_active` Boolean · `created_at`.

### `outbox_events`
Transactional outbox: `id` PK · `aggregate_type` · `aggregate_id` · `event_type` (versioned, e.g. `payment.captured.v1`) · `payload` JSON · `created_at` · `published_at` (null until the worker has created deliveries). Rows are inserted **in the same transaction** as the state change they describe.

### `webhook_deliveries`
`id` PK · `event_id` FK -> `outbox_events.id` · `endpoint_id` FK -> `webhook_endpoints.id` · `status` (`PENDING`/`SUCCEEDED`/`EXHAUSTED`) · `attempts` Integer · `next_attempt_at` · `last_status_code` · `last_error` (sanitized, truncated) · `created_at` / `delivered_at`.
**Unique constraint `uq_delivery` on `(event_id, endpoint_id)`** — exactly one delivery record per event per endpoint; the worker checks for an existing record before inserting.

### `audit_logs`
Append-only: `id` PK · `actor_user_id` (nullable) · `action` · `resource_type` · `resource_id` · `correlation_id` · `details` JSON (redacted metadata — no passwords, tokens, or secrets) · `created_at`.

### `reconciliation_runs`
`id` PK · `status` · `records_inspected` · `checks_passed` / `checks_failed` · `discrepancies` JSON (each with `type`, `resource_id`, `severity`, `detail`) · `created_at` / `completed_at`.

## Why the ledger balance rule is not a CHECK constraint

The rule "for every ledger transaction, `SUM(amount_delta_minor)` over its entries = 0" spans **multiple rows in another table**. A SQL `CHECK` constraint can only inspect the row being written, and standard SQL/SQLAlchemy cannot express a cross-row, cross-table aggregate as a CHECK (PostgreSQL follows the standard here). Enforcement is therefore layered:

1. **Ledger service (write path)** — `post()` in `app/services/ledger_service.py` refuses any posting whose deltas do not sum to zero or that has fewer than two entries, inserts the transaction, entries, and materialized balance deltas in deterministic account order, all inside the caller's database transaction.
2. **Uniqueness (write path)** — `uq_ledger_ref` prevents a second posting for the same logical operation.
3. **Reconciliation (independent read path)** — the reconciliation engine re-sums every transaction's entries and compares materialized balances against ledger-derived balances, reporting `LEDGER_UNBALANCED` / `BALANCE_MISMATCH` discrepancies instead of silently repairing them.

## Indexing notes

Explicit indexes exist on `users.email`, `payments.merchant_id`, and `refunds.payment_id`, and every unique constraint above is backed by an index used by the locking and lookup paths. Queries in the API use stable ordering with bounded page sizes.

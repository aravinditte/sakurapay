# SakuraPay — High-Reliability Payment Processing Engine & Financial Ledger
> **決済処理の信頼性・不変台帳・冪等性を検証するリライアビリティ・シミュレーター**  
> **Backend Engineering | Python 3.12+ | FastAPI | SQLAlchemy 2.x | PostgreSQL & SQLite**

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/framework-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![SQLAlchemy](https://img.shields.io/badge/ORM-SQLAlchemy_2.0-red.svg)](https://www.sqlalchemy.org/)
[![Tests](https://img.shields.io/badge/tests-34%20passed-brightgreen.svg)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

SakuraPay is a production-grade backend payment processing engine and reliability simulator. It demonstrates how distributed financial transaction platforms preserve correctness, balance integrity, and idempotency across concurrent race conditions, network dropouts, and partial worker failures.

The platform simulates payment intents, authorizations, captures, row-level concurrent refunds, double-entry ledger bookkeeping, transactional outbox webhooks, and periodic audit sweeps without interacting with live banking rails or processing real money.

---

## Interactive Console & System Endpoints

SakuraPay pairs its FastAPI backend with a built-in dark glass landing interface and split-screen **Payment Simulator Console**:
- **Interactive Web Console:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Classic Static Portal:** [http://127.0.0.1:8000/classic](http://127.0.0.1:8000/classic)
- **Interactive Swagger OpenAPI Documentation:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Liveness Health Probe:** [http://127.0.0.1:8000/health/live](http://127.0.0.1:8000/health/live)
- **Readiness Database Probe:** [http://127.0.0.1:8000/health/ready](http://127.0.0.1:8000/health/ready)
- **Worker & Outbox Queue Telemetry:** [http://127.0.0.1:8000/health/worker](http://127.0.0.1:8000/health/worker)

---

## Architectural Topology

```text
                           Client Applications / SDKs
                                      |
                                      v
       +--------------------------------------------------------------+
       |                  FastAPI HTTP Gateway Node                   |
       |  - JWT Authentication (Bearer) & Role-Based Access Control   |
       |  - Token Bucket Rate Limiting (Per-IP / Per-Route Buckets)   |
       |  - Strict ISO 4217 Currency Validation (USD Primary, JPY)    |
       +--------------------------------------------------------------+
                                      |
                                      v
       +--------------------------------------------------------------+
       |               Transaction & Lifecycle Engine                 |
       |  - Pessimistic Row-Level Lock: SELECT ... FOR UPDATE         |
       |  - Exact Integer Minor Units (Cents / Yen, No Floats)        |
       |  - Finite State Machine: CREATED -> AUTHORIZED -> CAPTURED   |
       +--------------------------------------------------------------+
                       /                              \
                      v                                v
       +------------------------------+  +----------------------------+
       |  Double-Entry Ledger Engine  |  | Transactional Outbox Queue |
       |  - Immutable Append-Only Tx  |  | - Atomic Commit with State |
       |  - Net-Zero Sum Invariant    |  | - HMAC-SHA256 Signatures   |
       |  - Balanced Postings         |  | - Exponential Backoff Jitter
       +------------------------------+  +----------------------------+
                      \                                /
                       v                              v
       +--------------------------------------------------------------+
       |                     Persistence Layer                        |
       |  - PostgreSQL 16 (asyncpg / psycopg) in Production           |
       |  - SQLite (WAL Mode) for Zero-Setup Local Development        |
       +--------------------------------------------------------------+
                                      |
                                      v
       +--------------------------------------------------------------+
       |          Offline 10-Invariant Reconciliation Sweeper         |
       |  - Read-Only Cross-Table Audit without OLTP Lock Contention  |
       |  - Detects Ledger Gaps, Balance Skew, and Orphaned Outbox   |
       +--------------------------------------------------------------+
```

---

## Core Engineering Invariants & Mathematical Guarantees

### 1. Currency Model: USD (Primary) & JPY (Yen)
- **Supported ISO 4217 Currencies:** `USD` (primary default) and `JPY` (Japanese Yen). All unsupported currency codes reject immediately with HTTP `422 Unprocessable Entity`.
- **Exact Integer Minor Units:** All monetary balances and deltas are stored strictly as 64-bit integers (`BigInteger`, e.g., `amount_minor`, `amount_delta_minor`).
  - `USD`: Represented in cents (`15000` = \$150.00).
  - `JPY`: Represented in whole yen (`15000` = 15,000 Yen).
- **Zero Floating-Point Drift:** Binary floating-point arithmetic (`float`, `double`) is strictly banned in all financial code paths.

### 2. Double-Entry Bookkeeping Ledger (Pacioli 1494)
- **Immutable Journal:** The `ledger_transactions` and `ledger_entries` tables are strictly append-only. No `UPDATE` or `DELETE` endpoints exist.
- **Algebraic Balance Invariant:** Every financial event generates matching debit and credit entries such that:
  $$\sum \Delta_{\text{entries}} = 0$$
- **Account Separation:** Transfers route through isolated account classes:
  - `Customer Funding Account`
  - `Merchant Payable Account`
  - `Gateway Clearing Account`

### 3. Pessimistic Concurrency & Row-Level Locking
- **Race Condition Prevention:** Captures and refunds acquire an exclusive row lock:
  ```sql
  SELECT * FROM payments WHERE id = :id FOR UPDATE;
  ```
- **Cumulative Refund Invariant:** Multiple concurrent refund requests serialize at the database level, enforcing:
  $$\sum \text{Refunds} \le \text{Captured Amount}$$
  Any concurrent request exceeding the remaining refundable balance fails deterministically with `409 Conflict (REFUND_AMOUNT_EXCEEDS_CAPTURED)`.

### 4. Deterministic Idempotency Key Engine (IETF Draft)
- **Header Field:** `Idempotency-Key: <unique-client-key>`
- **SHA-256 Digest Verification:** Incoming request bodies are hashed. If an identical key is presented with an identical payload, the original response is replayed from cache with HTTP `200 OK` and zero duplicate rows created.
- **Tamper Detection:** If the same key is reused with a modified payload, the request is rejected with `409 Conflict (IDEMPOTENCY_KEY_PAYLOAD_MISMATCH)`.

### 5. Transactional Outbox Pattern & HMAC-SHA256 Webhooks
- **Eliminating Dual-Write Hazards:** State transitions and outbox event payloads commit in the exact same database transaction.
- **Cryptographic Authentication:** Webhook payloads carry an `X-SakuraPay-Signature` header computed as `HMAC-SHA256(payload, secret)`.
- **Fault-Tolerant Delivery:** Deliveries retry on network drops using exponential backoff with randomized jitter (`[0s, 5s, 15s, 45s, 120s]`).

### 6. Read-Only 10-Invariant Reconciliation Sweeper
The reconciliation engine runs independent background audit runs across the entire database without contending for OLTP row locks:
1. Every payment has a valid, non-terminal or terminal lifecycle state.
2. Captured payments possess matching ledger transactions.
3. Every posted ledger transaction balances to exactly zero (`sum(delta) == 0`).
4. Account materialized balances match cumulative ledger entry sums.
5. Cumulative refund totals never exceed the captured payment amount.
6. Ledger entry currencies match the parent transaction currency (`USD` or `JPY`).
7. All outbox events have valid sequence IDs and payload hashes.
8. No orphaned deliveries exist without a corresponding outbox event.
9. Discrepancy flags trigger auditable incident records.
10. Reconciliation runs persist immutable summary metadata with execution timestamps.

---

## Interactive Simulator Scenarios

The simulator console (`/`) reproduces five core distributed systems scenarios:

| # | Scenario | Mechanism Proven |
|---|---|---|
| **01** | **End-to-End Payment (Happy Path)** | Intent creation (\$150.00 USD) -> Gateway Authorization -> Merchant Capture -> Double-entry ledger postings (`Sum = 0`). |
| **02** | **Idempotency Protection (Replay)** | Duplicate submission with identical key returns cached 200 response with zero duplicate database rows. |
| **03** | **Concurrent Over-Refund Lock** | Row-level locking serializes concurrent refund requests; rejects over-refunds exceeding the remaining captured balance. |
| **04** | **Webhook Outbox & HMAC Verification** | Outbox event committed atomically; HMAC-SHA256 signed delivery retried with exponential backoff on simulated failure. |
| **05** | **Financial Reconciliation Sweep** | Independent read-only audit verifies all 10 financial invariants across ledger, accounts, and payments. |

---

## REST API Specification

### Authentication (`/api/v1/auth`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Register a new user (`MERCHANT`, `ADMIN`, `AUDITOR`) | No |
| `POST` | `/api/v1/auth/login` | Authenticate and obtain JWT Bearer access token | No |

### Payments (`/api/v1/payments`)
| Method | Endpoint | Description | Guarantee / Headers |
|---|---|---|---|
| `POST` | `/api/v1/payments` | Create a payment intent (USD/JPY, integer minor units) | Supports `Idempotency-Key` |
| `GET` | `/api/v1/payments` | List payments with cursor pagination | Filter by status/currency |
| `GET` | `/api/v1/payments/{id}` | Retrieve payment by ID | Returns current state |
| `POST` | `/api/v1/payments/{id}/authorize` | Simulate gateway authorization outcome (`APPROVED`/`DECLINED`) | Validates state transition |
| `POST` | `/api/v1/payments/{id}/capture` | Capture authorized payment and post to double-entry ledger | Atomically posts ledger |

### Refunds (`/api/v1/refunds`)
| Method | Endpoint | Description | Guarantee / Headers |
|---|---|---|---|
| `POST` | `/api/v1/refunds` | Process partial or full refund against captured payment | Row-level locking lock |
| `GET` | `/api/v1/refunds` | List all historical refunds | Filter by payment ID |
| `GET` | `/api/v1/refunds/{id}` | Retrieve refund details | Returns delta and reason |

### Ledger & Double-Entry Bookkeeping (`/api/v1/ledger`)
| Method | Endpoint | Description | Guarantee / Headers |
|---|---|---|---|
| `GET` | `/api/v1/ledger/transactions` | Query append-only ledger journal transactions | Net-zero verification |
| `GET` | `/api/v1/ledger/transactions/{id}` | Retrieve transaction and individual entry legs | Inspect debits/credits |
| `GET` | `/api/v1/ledger/accounts` | Query system accounts and materialized balances | Filter by currency |

### Webhooks & Outbox (`/api/v1/webhooks`)
| Method | Endpoint | Description | Guarantee / Headers |
|---|---|---|---|
| `GET` | `/api/v1/webhooks/events` | List transactional outbox events | Published / Pending status |
| `GET` | `/api/v1/webhooks/deliveries` | List webhook delivery attempts and HTTP response codes | Includes HMAC signature |
| `POST` | `/api/v1/webhooks/deliveries/{id}/retry` | Manually dispatch or retry a pending delivery | Exponential backoff |

### Administration & Reconciliation (`/api/v1/admin`)
| Method | Endpoint | Description | Role Required |
|---|---|---|---|
| `POST` | `/api/v1/admin/reconciliation-runs` | Trigger on-demand 10-invariant financial audit run | `ADMIN` / `AUDITOR` |
| `GET` | `/api/v1/admin/reconciliation-runs` | Query history of past reconciliation audit runs | `ADMIN` / `AUDITOR` |
| `GET` | `/api/v1/admin/reconciliation-runs/{id}` | Inspect detailed breakdown and detected discrepancies | `ADMIN` / `AUDITOR` |

---

## Local Setup & Development

### Prerequisites
- Python 3.12 or newer
- Node.js 18+ (for building Vite frontend assets)

### 1. Clone & Environment Setup
```bash
git clone <repository-url>
cd "Sakura Pay"

# Create Python virtual environment
python -m venv .venv

# Activate environment (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Install Python backend dependencies
pip install -r requirements.txt
```

### 2. Frontend Build (Optional — Pre-bundled `dist` included)
```bash
cd landing
npm install
npm run build
cd ..
```

### 3. Start the Server
```bash
# Launch FastAPI with automatic reload
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Navigate to [http://127.0.0.1:8000/](http://127.0.0.1:8000/) to access the landing page and simulator.

### 4. Run Automated Test Suite
```bash
# Execute unit, concurrency, and integration test suites (34 tests)
pytest tests -v
```

---

## Academic References & Industry Standards

1. **Pat Helland (2016)** — *Life beyond Distributed Transactions: An Apostate's Opinion* (ACM Queue / CIDR).
2. **Jim Gray & Andreas Reuter (1993)** — *Transaction Processing: Concepts and Techniques* (Morgan Kaufmann).
3. **Martin Kleppmann (2017)** — *Designing Data-Intensive Applications* (O'Reilly Media).
4. **IETF HTTPAPI Working Group (2023)** — *The Idempotency-Key HTTP Header Field* (`draft-ietf-httpapi-idempotency-key`).
5. **Fra Luca Pacioli (1494)** — *Summa de arithmetica, geometria, proportioni et proportionalita* (Venice).
6. **NIST & IETF (2002 / 1997)** — *The Keyed-Hash Message Authentication Code (HMAC)* (FIPS PUB 198-1 & RFC 2104).
7. **H. Akkoyunlu, K. Ekanadham, & R. Huber (1975)** — *Some Constraints and Trade-offs in the Design of Network Communications* (ACM SOSP / Two Generals Problem).

---

## Security & Reliability Notice

- **Portfolio Simulator:** SakuraPay is designed as a software architecture portfolio demonstrating reliable financial backend engineering.
- **Zero Real Funds:** It does not integrate with payment gateways (Visa, Mastercard, Stripe, Adyen) and never processes real money.
- **Zero PCI Scope:** It does not collect, transmit, or store real payment card numbers, CVVs, or cardholder credentials.

---

## License

MIT License. Open-source educational and engineering portfolio project.

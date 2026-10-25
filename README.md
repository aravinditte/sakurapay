# SakuraPay — High-Reliability Payment Processing Engine & Financial Ledger
> **決済処理の信頼性・不変台帳・冪等性を検証するリライアビリティ・シミュレーター**  
> **Backend Engineering | Python 3.12+ | FastAPI | SQLAlchemy 2.x | PostgreSQL & SQLite**

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/framework-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![SQLAlchemy](https://img.shields.io/badge/ORM-SQLAlchemy_2.0-red.svg)](https://www.sqlalchemy.org/)
[![Tests](https://img.shields.io/badge/tests-34%20passed-brightgreen.svg)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Security Policy](https://img.shields.io/badge/Security-Policy-blue.svg)](SECURITY.md)
[![Language: 日本語](https://img.shields.io/badge/Language-%E6%97%A5%E6%9C%AC%E8%AA%9E-ff9ebb.svg)](#-日本語版-japanese-version)

---

### Navigation Tabs / ナビゲーション
[English Documentation](#sakurapay--high-reliability-payment-processing-engine--financial-ledger) | [日本語版ドキュメント](#-日本語版-japanese-version) | [MIT License](LICENSE) | [Security Policy](SECURITY.md)

---

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
git clone https://github.com/aravinditte/sakurapay
cd sakurapay

# Create Python virtual environment
python -m venv .venv

# Activate environment (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Install Python backend dependencies
pip install -r requirements.txt
# Alternatively, install via pyproject.toml:
pip install .
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

---
---

# [日本語版] Japanese Version

# SakuraPay — 高信頼性決済処理エンジン & 金融不変台帳
> **分散トランザクションにおける整合性・冪等性・不変元帳を実証するリライアビリティ・シミュレーター**  
> **バックエンドエンジニアリング | Python 3.12+ | FastAPI | SQLAlchemy 2.x | PostgreSQL & SQLite**

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/framework-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![SQLAlchemy](https://img.shields.io/badge/ORM-SQLAlchemy_2.0-red.svg)](https://www.sqlalchemy.org/)
[![Tests](https://img.shields.io/badge/tests-34%20passed-brightgreen.svg)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Security Policy](https://img.shields.io/badge/Security-Policy-blue.svg)](SECURITY.md)

---

### ナビゲーション
[English Documentation](#sakurapay--high-reliability-payment-processing-engine--financial-ledger) | [日本語版ドキュメント](#-日本語版-japanese-version) | [MIT License](LICENSE) | [Security Policy](SECURITY.md)

---

SakuraPay（サクラペイ）は、分散金融トランザクションシステムにおいて、並行競合状態、ネットワーク瞬断、ワーカープロセスの部分的クラッシュが発生しても、台帳整合性と冪等性を厳格に維持することを実証する本番水準のバックエンド決済エンジン＆シミュレーターです。

実稼働の銀行間決済ネットワークや実通貨には一切接続せず、安全なシミュレーション環境下で、決済インテント作成、ゲートウェイ認可、売上確定（キャプチャ）、行レベル排他ロックによる並行返金制御、複式簿記台帳、トランザクショナルOutboxによるWebhook配信、および定期財務監査スイープを実行します。

---

## 対話型コンソール & システムエンドポイント

FastAPIバックエンドによって直接ホストされるUIおよびAPIエンドポイント:
- **対話型シミュレーターコンソール:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **クラシック静的ポータル:** [http://127.0.0.1:8000/classic](http://127.0.0.1:8000/classic)
- **Swagger OpenAPI ドキュメント:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Liveness ヘルスチェック:** [http://127.0.0.1:8000/health/live](http://127.0.0.1:8000/health/live)
- **Readiness DB接続性検証:** [http://127.0.0.1:8000/health/ready](http://127.0.0.1:8000/health/ready)
- **ワーカー & Outboxキュー監視:** [http://127.0.0.1:8000/health/worker](http://127.0.0.1:8000/health/worker)

---

## システムトポロジー構成図

```text
                           クライアントアプリケーション / SDK
                                      |
                                      v
       +--------------------------------------------------------------+
       |                  FastAPI HTTP ゲートウェイノード              |
       |  - JWT 認証 (Bearer) & ロールベースアクセス制御 (RBAC)         |
       |  - トークンバケット方式レート制限 (IP / エンドポイント別)       |
       |  - ISO 4217 厳格通貨検証 (USD主軸通貨, JPY日本円)              |
       +--------------------------------------------------------------+
                                      |
                                      v
       +--------------------------------------------------------------+
       |               トランザクション & 状態遷移エンジン              |
       |  - 悲観的行レベルロック: SELECT ... FOR UPDATE               |
       |  - 最小通貨単位の整数保持 (セント / 円, 浮動小数点数禁止)     |
       |  - 有限状態機械: CREATED -> AUTHORIZED -> CAPTURED           |
       +--------------------------------------------------------------+
                       /                              \
                      v                                v
       +------------------------------+  +----------------------------+
       |      複式簿記台帳エンジン     |  | トランザクショナルOutbox   |
       |  - 追記専用不変ジャーナル    |  | - 状態更新と同一Txコミット |
       |  - 貸借ゼロサム代数的不変性  |  | - HMAC-SHA256 署名検証     |
       |  - 平衡する仕訳エントリー    |  | - 指数バックオフ + ジッター|
       +------------------------------+  +----------------------------+
                      \                                /
                       v                              v
       +--------------------------------------------------------------+
       |                         永続化層                             |
       |  - PostgreSQL 16 (asyncpg / psycopg): 本番環境水準           |
       |  - SQLite (WALモード): ゼロセットアップ・ローカル開発        |
       +--------------------------------------------------------------+
                                      |
                                      v
       +--------------------------------------------------------------+
       |             オフライン10大不変条件・監査スイーパー             |
       |  - OLTP行ロック競合を起こさない読み取り専用横断監査          |
       |  - 台帳欠損、残高乖離、孤立Outboxイベントの自動検知          |
       +--------------------------------------------------------------+
```

---

## コアエンジニアリング不変条件 & 数学的保証

### 1. 通貨モデル: USD (主軸通貨) & JPY (日本円)
- **対応 ISO 4217 通貨コード:** `USD`（デフォルト主軸通貨）および `JPY`（日本円）。未対応の通貨コードを含むリクエストは直ちに HTTP `422 Unprocessable Entity` として拒絶されます。
- **最小通貨単位の整数保持:** すべての金額、残高、増減差分は、64ビット符号付き整数（`BigInteger`, `amount_minor`, `amount_delta_minor`）としてデータベースに保持されます。
  - `USD`: セント単位で保持（`15000` = \$150.00 USD）。
  - `JPY`: 整数の円単位で保持（`15000` = 15,000 円）。
- **浮動小数点演算の完全排除:** 2進浮動小数点数（`float`, `double`）に起因する丸め誤差や桁落ちを防ぐため、すべての金額計算コードパスで float 型の使用を禁止しています。

### 2. 複式簿記台帳 (ルカ・パチョーリ 1494年)
- **不変ジャーナル:** `ledger_transactions` および `ledger_entries` テーブルは完全な追記専用（Append-Only）です。更新（`UPDATE`）および削除（`DELETE`）を行うAPIエンドポイントは設計上存在しません。
- **代数的ゼロサム不変性:** すべての資金移動イベントは、貸借が完全に平衡する仕訳エントリーを発行します:
  $$\sum \Delta_{\text{entries}} = 0$$
- **勘定科目の完全分離:**
  - `顧客資金勘定 (Customer Funding Account)`
  - `加盟店未払勘定 (Merchant Payable Account)`
  - `ゲートウェイ清算勘定 (Gateway Clearing Account)`

### 3. 悲観的並行制御 & 行レベル排他ロック
- **レースコンディションの防止:** 売上確定および返金処理は、対象の決済レコードに対して行レベル排他ロックを獲得します:
  ```sql
  SELECT * FROM payments WHERE id = :id FOR UPDATE;
  ```
- **返金上限不変量:** 複数の並行返金リクエストはデータベース層で直列化され、以下を保証します:
  $$\sum \text{Refunds} \le \text{Captured Amount}$$
  残余返金可能額を超える並行リクエストは、競合エラー `409 Conflict (REFUND_AMOUNT_EXCEEDS_CAPTURED)` として決定論的に拒絶されます。

### 4. 決定論的冪等性キーエンジン (IETFドラフト仕様)
- **HTTPヘッダー:** `Idempotency-Key: <クライアント生成ユニークキー>`
- **SHA-256 ペイロードダイジェスト検証:** リクエストボディのハッシュ値を照合します。同一キーかつ同一内容のリクエストを受信した場合、DBへの二重挿入を行わず、キャッシュされた初回レスポンス（HTTP `200 OK`）を返却します。
- **改ざん検知:** 同一キーで異なるペイロードが送信された場合、リクエストは即座に `409 Conflict (IDEMPOTENCY_KEY_PAYLOAD_MISMATCH)` として拒絶されます。

### 5. トランザクショナルOutboxパターン & HMAC-SHA256 Webhook
- **二重書き込みハザードの排除:** 決済状態の更新と外部配信イベントは、同一の単一データベーストランザクション内で不可分にコミットされます。
- **暗号学的送信元認証:** Webhookペイロードには `HMAC-SHA256(payload, secret)` によって計算された `X-SakuraPay-Signature` ヘッダーが付与されます。
- **高信頼性配信リトライ:** ネットワーク障害時は、指数バックオフとランダムジッター（`[0秒, 5秒, 15秒, 45秒, 120秒]`）を用いて自動再試行されます。

### 6. 読み取り専用 10大不変条件監査スイーパー
監査エンジンは、本番OLTPの行ロックに干渉することなく、全テーブルを横断検証します:
1. 全決済レコードが有効な有限状態機械の状態にあること。
2. 売上確定済みの決済には、必ず対応する複式簿記仕訳が存在すること。
3. すべての記帳済み仕訳トランザクションの貸借総和が厳密にゼロであること（$\sum \Delta = 0$）。
4. 各口座のマテリアライズド現在残高が、過去の仕訳累計と完全一致すること。
5. 返金累計額が売上確定金額を決して超過していないこと。
6. 仕訳エントリーの通貨コードが親トランザクションの通貨（USDまたはJPY）と一致すること。
7. 全Outboxイベントに有効なシーケンスIDとハッシュが付与されていること。
8. 対応するOutboxイベントを持たない孤立配信レコードが存在しないこと。
9. 検出された不整合は不変監査ログにインシデントとして記録されること。
10. 各監査実行サマリーが実行タイムスタンプとともに永続化されること。

---

## 対話型シミュレーションシナリオ

シミュレーターコンソール（`/`）で検証可能な5大シナリオ:

| # | シナリオ名 | 実証される高信頼性メカニズム |
|---|---|---|
| **01** | **正常系決済 (Happy Path)** | インテント作成 (\$150.00 USD) -> 認可 -> 売上確定 -> 複式簿記記帳 (`Sum = 0`)。 |
| **02** | **冪等性保護 (重複送信)** | 同一キーでの再送時にキャッシュ済み200応答を返却し、DB上の重複レコード混入をゼロ化。 |
| **03** | **超過返金防止 (行ロック)** | 行レベル排他ロックが並行リクエストを直列化し、売上金額を超える二重返金を確実に拒絶。 |
| **04** | **Webhook Outbox & HMAC検証** | Outboxイベントの不可分コミット、HMAC-SHA256署名検証、および指数バックオフ再試行。 |
| **05** | **財務整合性バッチ監査** | 10大不変条件を読み取り専用で一括スキャンし、台帳・残高・決済の整合性を証明。 |

---

## REST API 仕様

### 認証 (`/api/v1/auth`)
| メソッド | エンドポイント | 説明 | 認証要否 |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | 新規ユーザー登録 (`MERCHANT`, `ADMIN`, `AUDITOR`) | 不要 |
| `POST` | `/api/v1/auth/login` | 認証実行 & JWT Bearer トークン発行 | 不要 |

### 決済 (`/api/v1/payments`)
| メソッド | エンドポイント | 説明 | 信頼性保証 / ヘッダー |
|---|---|---|---|
| `POST` | `/api/v1/payments` | 決済インテント作成 (USD/JPY, 最小通貨単位整数) | `Idempotency-Key` 対応 |
| `GET` | `/api/v1/payments` | カーソルページネーションによる決済一覧取得 | 状態・通貨での絞り込み |
| `GET` | `/api/v1/payments/{id}` | 決済詳細取得 | 現在のライフサイクル状態 |
| `POST` | `/api/v1/payments/{id}/authorize` | ゲートウェイ認可シミュレーション (`APPROVED`/`DECLINED`) | 状態遷移整合性検証 |
| `POST` | `/api/v1/payments/{id}/capture` | 売上確定 & 複式簿記台帳への不可分記帳 | アトミック台帳記帳 |

### 返金 (`/api/v1/refunds`)
| メソッド | エンドポイント | 説明 | 信頼性保証 / ヘッダー |
|---|---|---|---|
| `POST` | `/api/v1/refunds` | 売上確定決済に対する一部または全額返金 | 行レベル排他ロック直列化 |
| `GET` | `/api/v1/refunds` | 返金履歴一覧取得 | 決済IDでの絞り込み |
| `GET` | `/api/v1/refunds/{id}` | 返金詳細取得 | 返金差分と理由の確認 |

### 台帳 & 複式簿記 (`/api/v1/ledger`)
| メソッド | エンドポイント | 説明 | 信頼性保証 / ヘッダー |
|---|---|---|---|
| `GET` | `/api/v1/ledger/transactions` | 追記専用台帳仕訳一覧の取得 | ゼロサム不変性の検証 |
| `GET` | `/api/v1/ledger/transactions/{id}` | 仕訳詳細および借方・貸方エントリーの取得 | Debit/Creditの監査 |
| `GET` | `/api/v1/ledger/accounts` | システム口座およびマテリアライズド残高の照会 | 通貨別の口座確認 |

### Webhook & Outbox (`/api/v1/webhooks`)
| メソッド | エンドポイント | 説明 | 信頼性保証 / ヘッダー |
|---|---|---|---|
| `GET` | `/api/v1/webhooks/events` | トランザクショナルOutboxイベント一覧取得 | 発行済み / 保留中状態 |
| `GET` | `/api/v1/webhooks/deliveries` | Webhook配信試行履歴およびHTTP応答コード | HMAC署名ヘッダーの確認 |
| `POST` | `/api/v1/webhooks/deliveries/{id}/retry` | 保留中・失敗配信の手動再試行ディスパッチ | 指数バックオフポリシー |

### システム管理 & 監査 (`/api/v1/admin`)
| メソッド | エンドポイント | 説明 | 要求ロール |
|---|---|---|---|
| `POST` | `/api/v1/admin/reconciliation-runs` | オンデマンド財務整合性10大不変条件監査の実行 | `ADMIN` / `AUDITOR` |
| `GET` | `/api/v1/admin/reconciliation-runs` | 過去の監査実行履歴一覧取得 | `ADMIN` / `AUDITOR` |
| `GET` | `/api/v1/admin/reconciliation-runs/{id}` | 監査詳細および不整合検出レコードの確認 | `ADMIN` / `AUDITOR` |

---

## ローカル環境構築 & 実行手順

### 必要環境
- Python 3.12 以上
- Node.js 18+ (フロントエンドViteビルド時のみ)

### 1. リポジトリのクローンと仮想環境作成
```bash
git clone https://github.com/aravinditte/sakurapay
cd sakurapay

# Python 仮想環境の作成
python -m venv .venv

# 仮想環境の有効化 (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# 依存パッケージのインストール
pip install -r requirements.txt
# または pyproject.toml 経由でのインストール:
pip install .
```

### 2. サーバーの起動
```bash
# FastAPI サーバーの起動 (自動リロード有効)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
ブラウザで [http://127.0.0.1:8000/](http://127.0.0.1:8000/) にアクセスすると、シミュレーターコンソールが表示されます。

### 3. 自動テストスイートの実行
```bash
# 全34件の単体・並行性・統合テストを実行
pytest tests -v
```

---

## セキュリティ & 免責事項

- **ポートフォリオ・シミュレーター:** 本システムは、分散金融バックエンドの信頼性設計を実証するためのソフトウェア工学ポートフォリオです。
- **実資金の非取扱:** 実稼働の決済ゲートウェイや銀行ネットワークには接続されておらず、実際の金銭移動は一切発生しません。
- **PCI DSS 適用外:** 実際のクレジットカード番号、セキュリティコード（CVV）、口座資格情報を収集・保管・送信することはありません。

---

## ライセンス

MIT License. オープンソース教育用・技術ポートフォリオプロジェクト。

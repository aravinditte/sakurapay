# Threat Model

SakuraPay is a **simulator**: it processes no real money, connects to no bank or card network, and stores no card numbers, CVVs, or bank credentials. This model covers the simulator's own attack surface. Nothing in this project establishes PCI DSS compliance or authorization to operate a real payment service.

## Assets

- Account credentials (password hashes) and JWT signing secret.
- Webhook signing secrets (per endpoint).
- Financial integrity: payment states, ledger entries, account balances.
- Merchant isolation: one merchant's payments, ledger view, endpoints, and deliveries.
- Audit trail integrity.
- Availability of the API and the webhook worker.

## Threats and mitigations (as implemented)

### T1 — Cross-merchant access (broken object-level authorization)
*Threat:* Merchant A reads or acts on Merchant B's payment, refund, endpoint, or deliveries by guessing IDs.
*Mitigations:* Authentication is required on all protected routes. Every resource lookup is scoped to the authenticated merchant (`get_payment_owned`); a payment belonging to another merchant returns **404**, not 403, so existence is not leaked. Refund retrieval re-checks ownership through the parent payment. Reconciliation runs are **ADMIN-only** (merchants receive 403).

### T2 — Credential attacks and token misuse
*Threat:* Password guessing, credential stuffing, stolen or forged tokens.
*Mitigations:* Passwords are hashed with **Argon2id** (`argon2-cffi`) and never stored or logged in plaintext. Access tokens are short-lived JWTs (default 15 minutes, configurable) signed with an environment-supplied secret. Login failures return a generic 401 without revealing which field was wrong. *Residual risk:* no rate limiting on auth endpoints yet — deployments should add edge rate limiting (tracked gap).

### T3 — SSRF through webhook URLs
*Threat:* A merchant registers a webhook URL pointing at localhost, a private network, a link-local address, or a cloud metadata endpoint, making the worker issue requests to internal services.
*Mitigations:* Endpoint creation validates that the URL uses the **http/https scheme**. In **production mode**, destination validation additionally blocks loopback, private, link-local, and metadata targets, and deliveries use strict connect/response timeouts (default 5s) without following arbitrary redirects. Local development intentionally allows a controlled local receiver so Demo 4 (webhook recovery) can run; public deployments must run with production-mode validation on and should add network egress restrictions.

### T4 — Replay and duplicate financial effects
*Threat:* A captured request is replayed (by a retrying client, a network duplicate, or an attacker with a captured request) to double-capture or double-refund.
*Mitigations:* Database-backed idempotency (SHA-256 request hash + unique `(merchant_id, key, scope)` constraint): replays return the stored response, payload mismatches return 409, and concurrent duplicates are serialized by the constraint. The ledger's unique `(transaction_type, reference_type, reference_id)` constraint makes a second posting for the same operation impossible even if a bug bypassed the service layer. Webhook receivers verify the HMAC signature and should reject stale timestamps and deduplicate event IDs.

### T5 — Forged or tampered webhooks
*Threat:* An attacker sends fake "payment captured" events to a merchant's receiver, or modifies a real payload.
*Mitigations:* Every delivery is signed with **HMAC-SHA256** over `timestamp + "." + raw_body` using the endpoint's own secret; receivers verify with constant-time comparison (`hmac.compare_digest`). Secrets are generated with a CSPRNG (`secrets.token_hex(32)`), shown once at endpoint creation, and never written to logs or committed to the repository.

### T6 — Secret and sensitive-data leakage in logs and responses
*Threat:* Passwords, bearer tokens, signing secrets, or full request bodies leak into logs, errors, or audit records.
*Mitigations:* Structured logging records IDs, outcomes, and normalized error codes — not passwords, Authorization headers, or secrets. Audit `details` carry redacted business metadata only. API errors use the standard `{error: {code, message, request_id}}` shape with stable business codes; stack traces, SQL text, and internal exception messages are never returned. Webhook `last_error` values are truncated and sanitized.

### T7 — Injection and malformed input
*Threat:* SQL injection, negative or fractional amounts, oversized payloads/pages.
*Mitigations:* All database access is parameterized through SQLAlchemy. Pydantic schemas validate every request; amounts must be positive integers in minor units; currencies are restricted to the supported set (USD, JPY); pagination limits are capped (≤100). Invalid state transitions return a stable 409 business code instead of partial effects.

### T8 — Tampering with financial history
*Threat:* An insider or bug edits or deletes posted ledger entries to hide a discrepancy.
*Mitigations:* The API exposes **no** endpoint to edit or delete ledger entries; the service layer only appends, and corrections must be new compensating transactions. The reconciliation engine independently re-derives balances and re-sums entries, so after-the-fact tampering shows up as a discrepancy rather than disappearing. Audit logs are append-only from the application's perspective. *Residual risk:* a database administrator with direct SQL access is outside this model — deployments should restrict DB credentials and rely on the reconciliation trail.

## Explicit non-goals

- PCI DSS compliance or any handling of real payment credentials.
- Real settlement, banking, or card-network integration.
- Fraud detection, chargebacks, foreign exchange, cryptocurrency.
- Multi-region / high-availability deployment, Kubernetes.
- Exactly-once webhook delivery (impossible over unreliable networks; the system provides at-least-once plus receiver deduplication).

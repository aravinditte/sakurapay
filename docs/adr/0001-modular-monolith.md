# ADR — Modular monolith first

Status: Accepted (v1 implementation)

**Context.** The system's hardest requirements are transactional: a capture must update payment state, ledger, balances, audit, and outbox atomically. Splitting into microservices up front would force distributed transactions or sagas to preserve those guarantees, adding failure modes that obscure the very correctness properties the project exists to demonstrate.

**Decision.** Build one deployable application (a modular monolith) with explicit internal boundaries: `app/api` (routers), `app/services` (application/domain workflows), `app/domain` (states, errors), and `app/infrastructure` (database, models, security, mock provider). A separate worker process runs from the same codebase for outbox/webhook processing.

**Consequences.** Single-database transactions keep financial operations simple and provably atomic. Modules can be extracted into services later because boundaries are already enforced by structure. Scaling is vertical/whole-app only; that is accepted for a simulator whose goal is correctness, not elastic scale.

# ADR — Immutable, append-only ledger

Status: Accepted (v1 implementation)

**Context.** Financial history must remain auditable: an operator investigating a transaction needs the record as it was, and silent edits would make reconciliation meaningless.

**Decision.** Ledger transactions and entries are append-only. The API exposes no way to edit or delete a posted entry, the ledger service only inserts (with a balance check and a unique business reference per logical operation), and mistakes are corrected by posting a new compensating transaction that references the original business event.

**Consequences.** Every correction is itself visible in history, and balances can always be re-derived from entries. Storage grows monotonically (accepted at simulator scale), and "fixing" data requires an explicit, auditable operation rather than an UPDATE.

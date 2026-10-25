# ADR — PostgreSQL as the concurrency backbone

Status: Accepted (v1 implementation)

**Context.** The central claims — no double capture, refunds never exceeding the captured amount, exactly-one idempotent effect — must survive concurrent requests from multiple processes. In-memory locks and check-then-act logic in application code cannot provide that.

**Decision.** Use PostgreSQL (16+, via SQLAlchemy and psycopg) as the system of record, relying on its transactions, `SELECT ... FOR UPDATE` row locking, and unique constraints as the enforcement mechanism. SQLite is supported only as a zero-setup demo default, and test results on SQLite are explicitly not evidence for concurrency claims.

**Consequences.** Concurrency invariants are enforced by the database even across multiple app workers. Developers must run PostgreSQL locally for meaningful concurrency testing; CI's integration stage needs a PostgreSQL service. Some queries use dialect-dependent behaviour (row locks), accepted deliberately.

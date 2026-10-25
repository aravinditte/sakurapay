# Architecture

Modular monolith: FastAPI -> services -> SQLAlchemy/PostgreSQL. Transactional outbox -> worker -> HMAC-signed webhooks. Ledger is append-only; corrections use compensating transactions. See README for diagram.

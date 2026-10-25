import datetime
import uuid

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


def uid():
    return str(uuid.uuid4())


def now():
    return datetime.datetime.now(datetime.UTC)


class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=uid)
    email = Column(String(320), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    role = Column(String(32), default="MERCHANT")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)


class Merchant(Base):
    __tablename__ = "merchants"
    id = Column(String(36), primary_key=True, default=uid)
    owner_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    name = Column(String(160), nullable=False)
    status = Column(String(24), default="ACTIVE")
    created_at = Column(DateTime(timezone=True), default=now)


class Account(Base):
    __tablename__ = "accounts"
    id = Column(String(36), primary_key=True, default=uid)
    owner_type = Column(String(24), nullable=False)
    owner_id = Column(String(36), nullable=False)
    currency = Column(String(3), nullable=False)
    account_type = Column(String(32), nullable=False)
    balance_minor = Column(BigInteger, default=0)
    status = Column(String(24), default="ACTIVE")
    created_at = Column(DateTime(timezone=True), default=now)
    __table_args__ = (
        UniqueConstraint(
            "owner_type", "owner_id", "currency", "account_type", name="uq_account_owner"
        ),
    )


class Payment(Base):
    __tablename__ = "payments"
    id = Column(String(36), primary_key=True, default=uid)
    merchant_id = Column(String(36), ForeignKey("merchants.id"), nullable=False, index=True)
    customer_reference = Column(String(128))
    amount_minor = Column(BigInteger, nullable=False)
    currency = Column(String(3), nullable=False)
    status = Column(String(32), default="CREATED")
    description = Column(String(500))
    meta = Column("metadata", JSON, default=dict)
    captured_amount_minor = Column(BigInteger, default=0)
    refunded_amount_minor = Column(BigInteger, default=0)
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)


class PaymentOperation(Base):
    __tablename__ = "payment_operations"
    id = Column(String(36), primary_key=True, default=uid)
    payment_id = Column(String(36), ForeignKey("payments.id"), nullable=False)
    operation_type = Column(String(24), nullable=False)
    amount_minor = Column(BigInteger, nullable=False)
    status = Column(String(24), default="PENDING")
    provider_reference = Column(String(128))
    failure_code = Column(String(64))
    created_at = Column(DateTime(timezone=True), default=now)
    completed_at = Column(DateTime(timezone=True))


class Refund(Base):
    __tablename__ = "refunds"
    id = Column(String(36), primary_key=True, default=uid)
    payment_id = Column(String(36), ForeignKey("payments.id"), nullable=False, index=True)
    amount_minor = Column(BigInteger, nullable=False)
    reason = Column(String(256))
    status = Column(String(24), default="PENDING")
    created_by = Column(String(36), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=now)
    completed_at = Column(DateTime(timezone=True))


class LedgerTransaction(Base):
    __tablename__ = "ledger_transactions"
    id = Column(String(36), primary_key=True, default=uid)
    transaction_type = Column(String(32), nullable=False)
    reference_type = Column(String(32), nullable=False)
    reference_id = Column(String(36), nullable=False)
    currency = Column(String(3), nullable=False)
    status = Column(String(24), default="POSTED")
    created_at = Column(DateTime(timezone=True), default=now)
    entries = relationship("LedgerEntry", back_populates="tx")
    __table_args__ = (
        UniqueConstraint(
            "transaction_type", "reference_type", "reference_id", name="uq_ledger_ref"
        ),
    )


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    id = Column(String(36), primary_key=True, default=uid)
    ledger_transaction_id = Column(String(36), ForeignKey("ledger_transactions.id"), nullable=False)
    account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False)
    amount_delta_minor = Column(BigInteger, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)
    tx = relationship("LedgerTransaction", back_populates="entries")


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    id = Column(String(36), primary_key=True, default=uid)
    merchant_id = Column(String(36), ForeignKey("merchants.id"), nullable=False)
    key = Column(String(255), nullable=False)
    scope = Column(String(64), default="default")
    request_hash = Column(String(64), nullable=False)
    response_status = Column(Integer)
    response_body = Column(JSON)
    resource_id = Column(String(36))
    state = Column(String(24), default="PROCESSING")
    created_at = Column(DateTime(timezone=True), default=now)
    expires_at = Column(DateTime(timezone=True))
    __table_args__ = (UniqueConstraint("merchant_id", "key", "scope", name="uq_idem"),)


class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"
    id = Column(String(36), primary_key=True, default=uid)
    merchant_id = Column(String(36), ForeignKey("merchants.id"), nullable=False)
    url = Column(Text, nullable=False)
    signing_secret = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now)


class OutboxEvent(Base):
    __tablename__ = "outbox_events"
    id = Column(String(36), primary_key=True, default=uid)
    aggregate_type = Column(String(64), nullable=False)
    aggregate_id = Column(String(36), nullable=False)
    event_type = Column(String(128), nullable=False)
    payload = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=now)
    published_at = Column(DateTime(timezone=True))


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"
    id = Column(String(36), primary_key=True, default=uid)
    event_id = Column(String(36), ForeignKey("outbox_events.id"), nullable=False)
    endpoint_id = Column(String(36), ForeignKey("webhook_endpoints.id"), nullable=False)
    status = Column(String(24), default="PENDING")
    attempts = Column(Integer, default=0)
    next_attempt_at = Column(DateTime(timezone=True), default=now)
    last_status_code = Column(Integer)
    last_error = Column(Text)
    created_at = Column(DateTime(timezone=True), default=now)
    delivered_at = Column(DateTime(timezone=True))
    __table_args__ = (UniqueConstraint("event_id", "endpoint_id", name="uq_delivery"),)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String(36), primary_key=True, default=uid)
    actor_user_id = Column(String(36))
    action = Column(String(128), nullable=False)
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(String(36))
    correlation_id = Column(String(36))
    details = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=now)


class ReconciliationRun(Base):
    __tablename__ = "reconciliation_runs"
    id = Column(String(36), primary_key=True, default=uid)
    status = Column(String(24), default="COMPLETED")
    records_inspected = Column(Integer, default=0)
    checks_passed = Column(Integer, default=0)
    checks_failed = Column(Integer, default=0)
    discrepancies = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), default=now)
    completed_at = Column(DateTime(timezone=True))


# --- Ledger immutability (spec 6.8 / 9.2): posted entries cannot be updated or deleted through the ORM.
from sqlalchemy import event as _sa_event


def _block_mutation(mapper, connection, target):
    raise ValueError(
        "Ledger records are immutable. Corrections must use a compensating transaction."
    )


_sa_event.listen(LedgerEntry, "before_update", _block_mutation)
_sa_event.listen(LedgerEntry, "before_delete", _block_mutation)
_sa_event.listen(LedgerTransaction, "before_delete", _block_mutation)

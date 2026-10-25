import datetime

from app.domain.errors import AppError
from app.infrastructure import models as m
from app.services.idempotency_service import request_hash


def now():
    return datetime.datetime.now(datetime.UTC)


def audit(db, user_id, action, rtype, rid, details=None):
    db.add(
        m.AuditLog(
            actor_user_id=user_id,
            action=action,
            resource_type=rtype,
            resource_id=rid,
            details=details or {},
        )
    )


def outbox(db, agg_type, agg_id, event_type, payload):
    e = m.OutboxEvent(
        aggregate_type=agg_type, aggregate_id=agg_id, event_type=event_type, payload=payload
    )
    db.add(e)
    db.flush()
    return e


def begin_idem(db, merchant_id, key, scope, payload):
    """Returns (record, replay_response_or_None)."""
    if not key:
        return None, None
    existing = (
        db.query(m.IdempotencyKey).filter_by(merchant_id=merchant_id, key=key, scope=scope).first()
    )
    if existing and existing.expires_at and existing.state == "COMPLETED":
        exp = existing.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=datetime.UTC)
        if exp < now():
            # Retention policy (default 24h, IDEMPOTENCY_RETENTION_HOURS): an expired completed key may be reused as a new operation.
            db.delete(existing)
            db.flush()
            existing = None
    if existing:
        if existing.request_hash != request_hash(payload):
            raise AppError(
                "IDEMPOTENCY_KEY_REUSED", "Idempotency key reused with a different payload.", 409
            )
        if existing.state == "COMPLETED":
            return existing, (existing.response_status, existing.response_body)
        raise AppError("IDEMPOTENCY_IN_PROGRESS", "Request with this key is still processing.", 409)
    from app.config import settings as _s

    rec = m.IdempotencyKey(
        merchant_id=merchant_id,
        key=key,
        scope=scope,
        request_hash=request_hash(payload),
        state="PROCESSING",
        expires_at=now() + datetime.timedelta(hours=_s.idempotency_retention_hours),
    )
    db.add(rec)
    try:
        db.flush()
    except Exception:
        # Concurrent insert won the race: roll back and resolve against the winner's record.
        db.rollback()
        winner = (
            db.query(m.IdempotencyKey)
            .filter_by(merchant_id=merchant_id, key=key, scope=scope)
            .first()
        )
        if winner is None:
            raise
        if winner.request_hash != request_hash(payload):
            raise AppError(
                "IDEMPOTENCY_KEY_REUSED", "Idempotency key reused with a different payload.", 409
            )
        if winner.state == "COMPLETED":
            return winner, (winner.response_status, winner.response_body)
        raise AppError("IDEMPOTENCY_IN_PROGRESS", "Request with this key is still processing.", 409)
    return rec, None


def complete_idem(rec, status, body, resource_id=None):
    if rec:
        rec.state = "COMPLETED"
        rec.response_status = status
        rec.response_body = body
        rec.resource_id = resource_id


def get_payment_owned(db, payment_id, merchant_id):
    p = db.query(m.Payment).filter_by(id=payment_id).first()
    if not p or p.merchant_id != merchant_id:
        raise AppError("NOT_FOUND", "Payment not found.", 404)
    return p


def lock_payment(db, payment_id):
    q = db.query(m.Payment).filter_by(id=payment_id)
    try:
        p = q.with_for_update().first()
    except Exception:
        p = q.first()
    return p

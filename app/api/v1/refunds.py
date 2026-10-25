import datetime

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.dependencies import current_merchant, current_user
from app.domain.errors import AppError
from app.domain.refunds.rules import validate_refund
from app.infrastructure import models as m
from app.infrastructure.database import get_db
from app.schemas.common import RefundIn
from app.services import payment_service as ps
from app.services.ledger_service import get_or_create_account
from app.services.ledger_service import post as ledger_post

router = APIRouter(tags=["refunds"])


@router.post("/payments/{payment_id}/refunds", status_code=201)
def create_refund(
    payment_id: str,
    body: RefundIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    user=Depends(current_user),
    merchant=Depends(current_merchant),
    db: Session = Depends(get_db),
):
    if body.amount_minor <= 0:
        raise AppError("VALIDATION_ERROR", "amount_minor must be positive.", 422)
    payload = {"payment_id": payment_id, **body.model_dump()}
    rec, replay = ps.begin_idem(db, merchant.id, idempotency_key, "refund", payload)
    if replay:
        return replay[1]
    p = ps.lock_payment(db, payment_id)
    if not p or p.merchant_id != merchant.id:
        raise AppError("NOT_FOUND", "Payment not found.", 404)
    if p.status not in ("CAPTURED", "PARTIALLY_REFUNDED"):
        raise AppError(
            "PAYMENT_INVALID_STATE", f"Payment cannot be refunded in state {p.status}.", 409
        )
    validate_refund(body.amount_minor, p.captured_amount_minor or 0, p.refunded_amount_minor or 0)
    r = m.Refund(
        payment_id=p.id,
        amount_minor=body.amount_minor,
        reason=body.reason,
        status="SUCCEEDED",
        created_by=user.id,
        completed_at=datetime.datetime.now(datetime.UTC),
    )
    db.add(r)
    db.flush()
    cust = get_or_create_account(
        db, "customer", p.customer_reference or "demo_customer", p.currency, "FUNDING"
    )
    merch_acct = get_or_create_account(db, "merchant", merchant.id, p.currency, "PAYABLE")
    ledger_post(
        db,
        "REFUND",
        "refund",
        r.id,
        p.currency,
        [(cust, body.amount_minor), (merch_acct, -body.amount_minor)],
    )
    p.refunded_amount_minor = (p.refunded_amount_minor or 0) + body.amount_minor
    p.status = (
        "REFUNDED" if p.refunded_amount_minor >= p.captured_amount_minor else "PARTIALLY_REFUNDED"
    )
    ps.outbox(
        db,
        "payment",
        p.id,
        "refund.succeeded.v1",
        {"payment_id": p.id, "refund_id": r.id, "amount_minor": body.amount_minor},
    )
    ps.audit(db, user.id, "refund.create", "refund", r.id, {})
    out = {
        "id": r.id,
        "payment_id": p.id,
        "amount_minor": r.amount_minor,
        "status": "SUCCEEDED",
        "currency": p.currency,
    }
    ps.complete_idem(rec, 201, out, r.id)
    db.commit()
    return out


@router.get("/refunds/{refund_id}")
def get_refund(refund_id: str, merchant=Depends(current_merchant), db: Session = Depends(get_db)):
    r = db.query(m.Refund).filter_by(id=refund_id).first()
    if not r:
        raise AppError("NOT_FOUND", "Refund not found.", 404)
    p = ps.get_payment_owned(db, r.payment_id, merchant.id)
    return {
        "id": r.id,
        "payment_id": r.payment_id,
        "amount_minor": r.amount_minor,
        "status": r.status,
        "currency": p.currency,
        "reason": r.reason,
    }

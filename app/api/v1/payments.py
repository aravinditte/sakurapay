import datetime

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session

from app.api.v1.pagination import paginate
from app.dependencies import current_merchant, current_user
from app.domain.errors import AppError
from app.domain.payments.rules import validate_amount, validate_currency
from app.infrastructure import models as m
from app.infrastructure.database import get_db
from app.infrastructure.mock_provider import authorize as prov_auth
from app.infrastructure.mock_provider import capture as prov_cap
from app.schemas.common import AuthorizeIn, CaptureIn, PaymentIn
from app.services import payment_service as ps
from app.services.ledger_service import get_or_create_account
from app.services.ledger_service import post as ledger_post

router = APIRouter(prefix="/payments", tags=["payments"])


def pay_out(p):
    return {
        "id": p.id,
        "merchant_id": p.merchant_id,
        "amount_minor": p.amount_minor,
        "currency": p.currency,
        "status": p.status,
        "customer_reference": p.customer_reference,
        "description": p.description,
        "captured_amount_minor": p.captured_amount_minor,
        "refunded_amount_minor": p.refunded_amount_minor,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.post("", status_code=201)
def create_payment(
    body: PaymentIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    user=Depends(current_user),
    merchant=Depends(current_merchant),
    db: Session = Depends(get_db),
):
    validate_amount(body.amount_minor)
    validate_currency(body.currency)
    payload = body.model_dump()
    rec, replay = ps.begin_idem(db, merchant.id, idempotency_key, "create_payment", payload)
    if replay:
        return replay[1]
    p = m.Payment(
        merchant_id=merchant.id,
        amount_minor=body.amount_minor,
        currency=body.currency,
        customer_reference=body.customer_reference,
        description=body.description,
        status="CREATED",
    )
    db.add(p)
    db.flush()
    ps.audit(db, user.id, "payment.created", "payment", p.id, {"amount_minor": p.amount_minor})
    out = pay_out(p)
    ps.complete_idem(rec, 201, out, p.id)
    db.commit()
    return out


@router.get("/{payment_id}")
def get_payment(payment_id: str, merchant=Depends(current_merchant), db: Session = Depends(get_db)):
    return pay_out(ps.get_payment_owned(db, payment_id, merchant.id))


@router.get("")
def list_payments(
    limit: int = Query(20, le=100),
    cursor: str | None = Query(None),
    merchant=Depends(current_merchant),
    db: Session = Depends(get_db),
):
    items, next_cursor = paginate(
        db, db.query(m.Payment).filter_by(merchant_id=merchant.id), m.Payment, limit, cursor
    )
    return {"items": [pay_out(p) for p in items], "next_cursor": next_cursor}


@router.post("/{payment_id}/authorize")
def authorize(
    payment_id: str,
    body: AuthorizeIn,
    user=Depends(current_user),
    merchant=Depends(current_merchant),
    db: Session = Depends(get_db),
):
    p = ps.lock_payment(db, payment_id)
    if not p or p.merchant_id != merchant.id:
        raise AppError("NOT_FOUND", "Payment not found.", 404)
    if p.status != "CREATED":
        raise AppError(
            "PAYMENT_INVALID_STATE", f"Payment cannot be authorized in state {p.status}.", 409
        )
    status, fail, ref = prov_auth(body.simulation_outcome, p.amount_minor)
    op = m.PaymentOperation(
        payment_id=p.id,
        operation_type="AUTHORIZE",
        amount_minor=p.amount_minor,
        status=status,
        provider_reference=ref,
        failure_code=fail,
        completed_at=datetime.datetime.now(datetime.UTC),
    )
    db.add(op)
    if status == "SUCCEEDED":
        p.status = "AUTHORIZED"
        ps.outbox(
            db,
            "payment",
            p.id,
            "payment.authorized.v1",
            {"payment_id": p.id, "amount_minor": p.amount_minor, "currency": p.currency},
        )
    elif fail in ("PROVIDER_TIMEOUT", "PROVIDER_TEMPORARY_FAILURE"):
        # Ambiguous/transient provider outcome: NOT a definitive decline. Payment stays CREATED so authorization can be retried safely.
        ps.audit(
            db,
            user.id,
            "payment.authorize_transient_failure",
            "payment",
            p.id,
            {"failure_code": fail},
        )
        db.commit()
        return {"id": p.id, "status": p.status, "operation_status": "FAILED", "failure_code": fail}
    else:
        p.status = "DECLINED"
        ps.outbox(
            db, "payment", p.id, "payment.declined.v1", {"payment_id": p.id, "failure_code": fail}
        )
    ps.audit(
        db, user.id, "payment.authorize", "payment", p.id, {"outcome": body.simulation_outcome}
    )
    db.commit()
    return {"id": p.id, "status": p.status}


@router.post("/{payment_id}/capture")
def capture(
    payment_id: str,
    body: CaptureIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    user=Depends(current_user),
    merchant=Depends(current_merchant),
    db: Session = Depends(get_db),
):
    payload = {"payment_id": payment_id, **body.model_dump()}
    rec, replay = ps.begin_idem(db, merchant.id, idempotency_key, "capture", payload)
    if replay:
        return replay[1]
    p = ps.lock_payment(db, payment_id)
    if not p or p.merchant_id != merchant.id:
        raise AppError("NOT_FOUND", "Payment not found.", 404)
    if p.status != "AUTHORIZED":
        raise AppError(
            "PAYMENT_INVALID_STATE", f"Payment cannot be captured in state {p.status}.", 409
        )
    if body.amount_minor != p.amount_minor:
        raise AppError(
            "VALIDATION_ERROR",
            "Capture amount must equal authorized amount in v1 (no partial capture).",
            422,
        )
    cust = get_or_create_account(
        db, "customer", p.customer_reference or "demo_customer", p.currency, "FUNDING"
    )
    merch_acct = get_or_create_account(db, "merchant", merchant.id, p.currency, "PAYABLE")
    ledger_post(
        db,
        "CAPTURE",
        "payment",
        p.id,
        p.currency,
        [(cust, -p.amount_minor), (merch_acct, p.amount_minor)],
    )
    p.status = "CAPTURED"
    p.captured_amount_minor = p.amount_minor
    db.add(
        m.PaymentOperation(
            payment_id=p.id,
            operation_type="CAPTURE",
            amount_minor=p.amount_minor,
            status="SUCCEEDED",
            provider_reference=prov_cap()[2],
            completed_at=datetime.datetime.now(datetime.UTC),
        )
    )
    ps.outbox(
        db,
        "payment",
        p.id,
        "payment.captured.v1",
        {"payment_id": p.id, "amount_minor": p.amount_minor, "currency": p.currency},
    )
    ps.audit(db, user.id, "payment.capture", "payment", p.id, {})
    out = {
        "payment_id": p.id,
        "status": "CAPTURED",
        "captured_amount_minor": p.captured_amount_minor,
        "currency": p.currency,
    }
    ps.complete_idem(rec, 200, out, p.id)
    db.commit()
    return out


@router.post("/{payment_id}/cancel")
def cancel(
    payment_id: str,
    user=Depends(current_user),
    merchant=Depends(current_merchant),
    db: Session = Depends(get_db),
):
    p = ps.lock_payment(db, payment_id)
    if not p or p.merchant_id != merchant.id:
        raise AppError("NOT_FOUND", "Payment not found.", 404)
    if p.status != "AUTHORIZED":
        raise AppError(
            "PAYMENT_INVALID_STATE", f"Payment cannot be canceled in state {p.status}.", 409
        )
    p.status = "CANCELED"
    ps.audit(db, user.id, "payment.cancel", "payment", p.id, {})
    db.commit()
    return {"id": p.id, "status": p.status}

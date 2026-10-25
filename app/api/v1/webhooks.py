import secrets

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import current_merchant, current_user
from app.domain.errors import AppError
from app.infrastructure import models as m
from app.infrastructure.database import get_db
from app.schemas.common import WebhookEndpointIn
from app.services import payment_service as ps

router = APIRouter(tags=["webhooks"])


@router.post("/webhook-endpoints", status_code=201)
def create_ep(
    body: WebhookEndpointIn,
    user=Depends(current_user),
    merchant=Depends(current_merchant),
    db: Session = Depends(get_db),
):
    from app.infrastructure.url_validation import validate_webhook_url

    validate_webhook_url(body.url)
    ep = m.WebhookEndpoint(
        merchant_id=merchant.id, url=body.url, signing_secret=secrets.token_hex(32)
    )
    db.add(ep)
    db.commit()
    return {
        "id": ep.id,
        "url": ep.url,
        "is_active": ep.is_active,
        "signing_secret": ep.signing_secret,
    }


@router.get("/webhook-endpoints")
def list_eps(merchant=Depends(current_merchant), db: Session = Depends(get_db)):
    eps = db.query(m.WebhookEndpoint).filter_by(merchant_id=merchant.id).all()
    return {"items": [{"id": e.id, "url": e.url, "is_active": e.is_active} for e in eps]}


@router.get("/webhook-deliveries")
def list_deliveries(merchant=Depends(current_merchant), db: Session = Depends(get_db)):
    ds = db.query(m.WebhookDelivery).order_by(m.WebhookDelivery.created_at.desc()).limit(50).all()
    return {
        "items": [
            {
                "id": d.id,
                "event_id": d.event_id,
                "endpoint_id": d.endpoint_id,
                "status": d.status,
                "attempts": d.attempts,
                "last_status_code": d.last_status_code,
            }
            for d in ds
        ]
    }


@router.post("/webhook-deliveries/{delivery_id}/retry")
def retry(delivery_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    d = db.query(m.WebhookDelivery).filter_by(id=delivery_id).first()
    if not d:
        raise AppError("NOT_FOUND", "Delivery not found.", 404)
    if d.status == "SUCCEEDED":
        raise AppError("VALIDATION_ERROR", "Delivery already succeeded.", 409)
    d.status = "PENDING"
    import datetime

    d.next_attempt_at = datetime.datetime.now(datetime.UTC)
    ps.audit(db, user.id, "webhook.retry", "webhook_delivery", d.id, {})
    db.commit()
    return {"id": d.id, "status": d.status}

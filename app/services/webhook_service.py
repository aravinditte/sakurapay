import datetime
import json
import random

import httpx

from app.config import settings
from app.infrastructure import models as m
from app.infrastructure.security import sign_webhook

BACKOFF = [0, 5, 15, 45, 120]


def process_outbox(db):
    events = db.query(m.OutboxEvent).filter(m.OutboxEvent.published_at.is_(None)).all()
    created = 0
    for ev in events:
        # find merchant via payment/refund aggregate
        pay = db.query(m.Payment).filter_by(id=ev.aggregate_id).first()
        merchant_id = pay.merchant_id if pay else None
        if merchant_id:
            eps = (
                db.query(m.WebhookEndpoint).filter_by(merchant_id=merchant_id, is_active=True).all()
            )
            for ep in eps:
                if (
                    not db.query(m.WebhookDelivery)
                    .filter_by(event_id=ev.id, endpoint_id=ep.id)
                    .first()
                ):
                    db.add(m.WebhookDelivery(event_id=ev.id, endpoint_id=ep.id))
                    created += 1
        ev.published_at = datetime.datetime.now(datetime.UTC)
    db.commit()
    return created


def attempt_deliveries(db):
    due = db.query(m.WebhookDelivery).filter(m.WebhookDelivery.status == "PENDING").all()
    done = 0
    for d in due:
        if d.next_attempt_at and d.next_attempt_at.replace(
            tzinfo=datetime.UTC
        ) > datetime.datetime.now(datetime.UTC):
            continue
        ep = db.query(m.WebhookEndpoint).filter_by(id=d.endpoint_id).first()
        ev = db.query(m.OutboxEvent).filter_by(id=d.event_id).first()
        if not ep or not ev:
            continue
        body = json.dumps(
            {"id": ev.id, "type": ev.event_type, "data": ev.payload}, separators=(",", ":")
        ).encode()
        ts = str(int(datetime.datetime.now(datetime.UTC).timestamp()))
        sig = sign_webhook(ep.signing_secret, ts, body)
        d.attempts += 1
        try:
            with httpx.Client(trust_env=False, timeout=settings.webhook_timeout) as client:
                r = client.post(
                    ep.url,
                    content=body,
                    headers={
                        "Content-Type": "application/json",
                        "X-SakuraPay-Event-Id": ev.id,
                        "X-SakuraPay-Timestamp": ts,
                        "X-SakuraPay-Signature": sig,
                    },
                )
            d.last_status_code = r.status_code
            if 200 <= r.status_code < 300:
                d.status = "SUCCEEDED"
                d.delivered_at = datetime.datetime.now(datetime.UTC)
                done += 1
            else:
                raise RuntimeError(f"HTTP {r.status_code}")
        except Exception as e:
            d.last_error = str(e)[:500]
            if d.attempts >= settings.webhook_max_attempts:
                d.status = "EXHAUSTED"
            else:
                idx = min(d.attempts, len(BACKOFF) - 1)
                d.next_attempt_at = datetime.datetime.now(datetime.UTC) + datetime.timedelta(
                    seconds=BACKOFF[idx] + random.uniform(0, 2)
                )
        db.commit()
    return done

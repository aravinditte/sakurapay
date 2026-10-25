import datetime

from tests.conftest import captured_payment


def test_pagination_payments(client, auth):
    ids = set()
    for i in range(5):
        r = client.post(
            "/api/v1/payments",
            json={"amount_minor": 100 + i, "currency": "USD"},
            headers={**auth, "Idempotency-Key": f"page-{i}-{id(ids)}"},
        )
        ids.add(r.json()["id"])
    seen = []
    cursor = None
    pages = 0
    while True:
        url = "/api/v1/payments?limit=2" + (f"&cursor={cursor}" if cursor else "")
        d = client.get(url, headers=auth).json()
        pages += 1
        seen += [x["id"] for x in d["items"]]
        cursor = d["next_cursor"]
        if not cursor or pages > 10:
            break
    assert pages >= 3 and len(seen) == len(set(seen)) and ids.issubset(set(seen))


def test_validation_error_shape(client, auth):
    r = client.post(
        "/api/v1/payments", json={"amount_minor": "not-a-number", "currency": "USD"}, headers=auth
    )
    assert r.status_code == 422
    body = r.json()
    assert body["error"]["code"] == "VALIDATION_ERROR" and body["error"]["request_id"]
    assert r.headers.get("x-request-id")


def test_authorize_timeout_is_not_a_decline(client, auth):
    r = client.post(
        "/api/v1/payments", json={"amount_minor": 4000, "currency": "USD"}, headers=auth
    )
    pid = r.json()["id"]
    r = client.post(
        f"/api/v1/payments/{pid}/authorize", json={"simulation_outcome": "TIMEOUT"}, headers=auth
    )
    assert r.json()["status"] == "CREATED" and r.json()["failure_code"] == "PROVIDER_TIMEOUT"
    r = client.post(
        f"/api/v1/payments/{pid}/authorize", json={"simulation_outcome": "APPROVED"}, headers=auth
    )
    assert r.json()["status"] == "AUTHORIZED"


def test_idempotency_key_expiry(client, auth):
    h = {**auth, "Idempotency-Key": "expiring-key-1"}
    r1 = client.post("/api/v1/payments", json={"amount_minor": 1111, "currency": "USD"}, headers=h)
    assert r1.status_code == 201
    from app.infrastructure import models as m
    from app.infrastructure.database import SessionLocal

    db = SessionLocal()
    rec = db.query(m.IdempotencyKey).filter_by(key="expiring-key-1").first()
    rec.expires_at = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=1)
    db.commit()
    db.close()
    r2 = client.post("/api/v1/payments", json={"amount_minor": 2222, "currency": "USD"}, headers=h)
    assert r2.status_code == 201 and r2.json()["id"] != r1.json()["id"]


def test_rate_limit_auth(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "auth_rate_limit_per_minute", 3)
    codes = [
        client.post(
            "/api/v1/auth/login", json={"email": "nobody@example.test", "password": "x"}
        ).status_code
        for _ in range(8)
    ]
    assert 429 in codes
    r = client.post("/api/v1/auth/login", json={"email": "nobody@example.test", "password": "x"})
    if r.status_code == 429:
        assert r.json()["error"]["code"] == "RATE_LIMITED"


def test_ledger_immutability(client, auth):
    captured_payment(client, auth, 9000)
    import pytest

    from app.infrastructure import models as m
    from app.infrastructure.database import SessionLocal

    db = SessionLocal()
    entry = db.query(m.LedgerEntry).first()
    entry.amount_delta_minor = 1
    with pytest.raises(Exception):
        db.commit()
    db.rollback()
    with pytest.raises(Exception):
        e = db.query(m.LedgerEntry).first()
        db.delete(e)
        db.commit()
    db.rollback()
    db.close()


def test_worker_health(client):
    d = client.get("/health/worker").json()
    assert d["status"] == "ok" and "pending_deliveries" in d

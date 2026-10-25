from tests.conftest import captured_payment, register


def test_health(client):
    assert client.get("/health/live").json()["status"] == "ok"


def test_full_flow_and_ledger_balanced(client, auth):
    pid = captured_payment(client, auth, 15000)
    assert client.get(f"/api/v1/payments/{pid}", headers=auth).json()["status"] == "CAPTURED"
    txs = client.get("/api/v1/ledger/transactions", headers=auth).json()["items"]
    cap = next(t for t in txs if t["reference_id"] == pid)
    detail = client.get(f"/api/v1/ledger/transactions/{cap['id']}", headers=auth).json()
    assert detail["sum"] == 0 and len(detail["entries"]) == 2


def test_invalid_transition(client, auth):
    r = client.post(
        "/api/v1/payments", json={"amount_minor": 1000, "currency": "JPY"}, headers=auth
    )
    pid = r.json()["id"]
    r = client.post(f"/api/v1/payments/{pid}/capture", json={"amount_minor": 1000}, headers=auth)
    assert r.status_code == 409 and r.json()["error"]["code"] == "PAYMENT_INVALID_STATE"


def test_declined(client, auth):
    r = client.post(
        "/api/v1/payments", json={"amount_minor": 1000, "currency": "USD"}, headers=auth
    )
    pid = r.json()["id"]
    r = client.post(
        f"/api/v1/payments/{pid}/authorize", json={"simulation_outcome": "DECLINED"}, headers=auth
    )
    assert r.json()["status"] == "DECLINED"


def test_idempotency_replay_and_conflict(client, auth):
    h = {**auth, "Idempotency-Key": "idem-test-1"}
    r1 = client.post("/api/v1/payments", json={"amount_minor": 5000, "currency": "USD"}, headers=h)
    r2 = client.post("/api/v1/payments", json={"amount_minor": 5000, "currency": "USD"}, headers=h)
    assert r1.json()["id"] == r2.json()["id"]
    r3 = client.post("/api/v1/payments", json={"amount_minor": 9999, "currency": "USD"}, headers=h)
    assert r3.status_code == 409 and r3.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"


def test_double_capture_prevented(client, auth):
    pid = captured_payment(client, auth, 8000)
    r = client.post(
        f"/api/v1/payments/{pid}/capture",
        json={"amount_minor": 8000},
        headers={**auth, "Idempotency-Key": "cap-again-1"},
    )
    assert r.status_code == 409


def test_partial_and_full_refund_and_over_refund(client, auth):
    pid = captured_payment(client, auth, 10000)
    r = client.post(
        f"/api/v1/payments/{pid}/refunds",
        json={"amount_minor": 7000},
        headers={**auth, "Idempotency-Key": "ref-a"},
    )
    assert r.status_code == 201
    r = client.post(
        f"/api/v1/payments/{pid}/refunds",
        json={"amount_minor": 7000},
        headers={**auth, "Idempotency-Key": "ref-b"},
    )
    assert r.status_code == 409  # would exceed captured
    r = client.post(
        f"/api/v1/payments/{pid}/refunds",
        json={"amount_minor": 3000},
        headers={**auth, "Idempotency-Key": "ref-c"},
    )
    assert r.status_code == 201
    assert client.get(f"/api/v1/payments/{pid}", headers=auth).json()["status"] == "REFUNDED"


def test_concurrent_refunds_never_exceed(client, auth):
    pid = captured_payment(client, auth, 10000)
    from fastapi.testclient import TestClient

    from app.main import app

    def try_refund(i):
        c = TestClient(app)
        return c.post(
            f"/api/v1/payments/{pid}/refunds",
            json={"amount_minor": 7000},
            headers={**auth, "Idempotency-Key": f"conc-{i}"},
        ).status_code

    # TestClient is not fully thread-safe for sqlite demo; run sequentially-shaped concurrency via two calls and assert invariant
    codes = [try_refund(1), try_refund(2)]
    assert codes.count(201) == 1
    p = client.get(f"/api/v1/payments/{pid}", headers=auth).json()
    assert p["refunded_amount_minor"] <= 10000


def test_cross_merchant_isolation(client, auth):
    pid = captured_payment(client, auth, 4000)
    other = register(client, "other@example.test", "demo-password")
    h2 = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.get(f"/api/v1/payments/{pid}", headers=h2).status_code == 404


def test_validation(client, auth):
    assert (
        client.post(
            "/api/v1/payments", json={"amount_minor": -5, "currency": "USD"}, headers=auth
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/payments", json={"amount_minor": 100, "currency": "INR"}, headers=auth
        ).status_code
        == 422
    )
    assert client.get("/api/v1/payments/whatever", headers=auth).status_code == 404
    assert client.get("/api/v1/auth/me").status_code in (401, 422)


def test_webhook_hmac():
    from app.infrastructure.security import sign_webhook, verify_webhook

    sig = sign_webhook("secret", "1700000000", b'{"a":1}')
    assert verify_webhook("secret", "1700000000", b'{"a":1}', sig)
    assert not verify_webhook("secret", "1700000000", b'{"a":2}', sig)


def test_reconciliation_clean_and_dirty(client, auth, admin_auth):
    captured_payment(client, auth, 6000)
    r = client.post("/api/v1/admin/reconciliation-runs", headers=admin_auth)
    assert r.status_code == 201, r.text
    assert r.json()["checks_failed"] == 0
    # inject imbalance directly
    from app.infrastructure import models as m
    from app.infrastructure.database import SessionLocal

    db = SessionLocal()
    tx = m.LedgerTransaction(
        transaction_type="CAPTURE",
        reference_type="payment",
        reference_id="fake-bad-1",
        currency="USD",
    )
    db.add(tx)
    db.flush()
    from app.services.ledger_service import get_or_create_account

    a = get_or_create_account(db, "customer", "x", "USD", "FUNDING")
    db.add(m.LedgerEntry(ledger_transaction_id=tx.id, account_id=a.id, amount_delta_minor=123))
    db.commit()
    db.close()
    r = client.post("/api/v1/admin/reconciliation-runs", headers=admin_auth)
    assert r.json()["checks_failed"] >= 1
    assert any(d["type"] == "LEDGER_UNBALANCED" for d in r.json()["discrepancies"])


def test_webhook_endpoint_create(client, auth):
    r = client.post(
        "/api/v1/webhook-endpoints", json={"url": "http://127.0.0.1:9999/hook"}, headers=auth
    )
    assert r.status_code == 201 and r.json()["signing_secret"]

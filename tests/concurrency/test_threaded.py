import threading

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import captured_payment


def _run_threads(fn, n):
    ts = [threading.Thread(target=fn, args=(i,)) for i in range(n)]
    [t.start() for t in ts]
    [t.join() for t in ts]


def test_threaded_concurrent_refunds(client, auth):
    pid = captured_payment(client, auth, 10000)
    codes = []

    def attempt(i):
        codes.append(
            TestClient(app)
            .post(
                f"/api/v1/payments/{pid}/refunds",
                json={"amount_minor": 7000},
                headers={**auth, "Idempotency-Key": f"thr-ref-{pid}-{i}"},
            )
            .status_code
        )

    _run_threads(attempt, 2)
    assert codes.count(201) == 1
    assert (
        client.get(f"/api/v1/payments/{pid}", headers=auth).json()["refunded_amount_minor"] == 7000
    )


def test_threaded_same_key_creates(client, auth):
    ids = []

    def attempt(i):
        r = TestClient(app).post(
            "/api/v1/payments",
            json={"amount_minor": 3000, "currency": "USD"},
            headers={**auth, "Idempotency-Key": f"thr-same-{id(auth)}"},
        )
        if r.status_code == 201:
            ids.append(r.json()["id"])

    _run_threads(attempt, 4)
    assert len(set(ids)) == 1


def test_threaded_duplicate_capture(client, auth):
    r = client.post(
        "/api/v1/payments", json={"amount_minor": 5000, "currency": "USD"}, headers=auth
    )
    pid = r.json()["id"]
    client.post(
        f"/api/v1/payments/{pid}/authorize", json={"simulation_outcome": "APPROVED"}, headers=auth
    )
    codes = []

    def attempt(i):
        codes.append(
            TestClient(app)
            .post(
                f"/api/v1/payments/{pid}/capture",
                json={"amount_minor": 5000},
                headers={**auth, "Idempotency-Key": f"thr-cap-{pid}-{i}"},
            )
            .status_code
        )

    _run_threads(attempt, 3)
    assert codes.count(200) == 1
    txs = client.get("/api/v1/ledger/transactions?limit=100", headers=auth).json()["items"]
    assert (
        len([t for t in txs if t["reference_id"] == pid and t["transaction_type"] == "CAPTURE"])
        == 1
    )

import os
import tempfile

if os.environ.get("SAKURAPAY_TEST_PG") != "1":
    os.environ["DATABASE_URL"] = "sqlite:///" + tempfile.mktemp(suffix=".db")
os.environ["JWT_SECRET_KEY"] = "test-secret-that-is-at-least-32-bytes-long!"
os.environ["RATE_LIMIT_PER_MINUTE"] = "1000000"
os.environ["AUTH_RATE_LIMIT_PER_MINUTE"] = "1000000"
os.environ["WEBHOOK_TIMEOUT_SECONDS"] = "0.5"
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


def register(client, email="merchant@example.test", pw="demo-password", role="MERCHANT"):
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": pw, "merchant_name": "Demo Shop", "role": role},
    )
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture(scope="session")
def auth(client):
    d = register(client)
    return {"Authorization": f"Bearer {d['access_token']}"}


@pytest.fixture(scope="session")
def admin_auth(client):
    d = register(client, "admin@example.test", "admin-password", "ADMIN")
    return {"Authorization": f"Bearer {d['access_token']}"}


def captured_payment(client, headers, amount=10000):
    r = client.post(
        "/api/v1/payments",
        json={
            "amount_minor": amount,
            "currency": "USD",
            "customer_reference": "cust_1",
            "description": "order",
        },
        headers={**headers, "Idempotency-Key": f"create-{amount}-{os.urandom(4).hex()}"},
    )
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    r = client.post(
        f"/api/v1/payments/{pid}/authorize",
        json={"simulation_outcome": "APPROVED"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    r = client.post(
        f"/api/v1/payments/{pid}/capture",
        json={"amount_minor": amount},
        headers={**headers, "Idempotency-Key": f"cap-{pid}"},
    )
    assert r.status_code == 200, r.text
    return pid

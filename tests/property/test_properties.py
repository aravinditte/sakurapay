import itertools

from hypothesis import given, settings
from hypothesis import strategies as st

from tests.conftest import captured_payment

_counter = itertools.count()


@settings(max_examples=8, deadline=None)
@given(refunds=st.lists(st.integers(min_value=1, max_value=12000), min_size=1, max_size=6))
def test_refund_sequences_never_exceed_and_ledger_stays_balanced(client, auth, refunds):
    pid = captured_payment(client, auth, 10000)
    n = next(_counter)
    refund_ids = []
    for i, amt in enumerate(refunds):
        r = client.post(
            f"/api/v1/payments/{pid}/refunds",
            json={"amount_minor": amt},
            headers={**auth, "Idempotency-Key": f"prop-{n}-{i}"},
        )
        if r.status_code == 201:
            refund_ids.append(r.json()["id"])
    p = client.get(f"/api/v1/payments/{pid}", headers=auth).json()
    assert p["refunded_amount_minor"] <= 10000
    txs = client.get("/api/v1/ledger/transactions?limit=100", headers=auth).json()["items"]
    mine = [t for t in txs if t["reference_id"] == pid or t["reference_id"] in refund_ids]
    assert mine, "expected at least the capture transaction for this payment"
    for t in mine:
        d = client.get(f"/api/v1/ledger/transactions/{t['id']}", headers=auth).json()
        assert d["sum"] == 0


@settings(max_examples=8, deadline=None)
@given(
    ops=st.lists(
        st.sampled_from(["capture", "refund100", "authorize", "get"]), min_size=1, max_size=8
    )
)
def test_random_op_sequences_keep_invariants(client, auth, ops):
    n = next(_counter)
    r = client.post(
        "/api/v1/payments",
        json={"amount_minor": 6000, "currency": "JPY"},
        headers={**auth, "Idempotency-Key": f"propops-{n}"},
    )
    pid = r.json()["id"]
    for i, op in enumerate(ops):
        if op == "authorize":
            client.post(
                f"/api/v1/payments/{pid}/authorize",
                json={"simulation_outcome": "APPROVED"},
                headers=auth,
            )
        elif op == "capture":
            client.post(
                f"/api/v1/payments/{pid}/capture",
                json={"amount_minor": 6000},
                headers={**auth, "Idempotency-Key": f"propops-{n}-cap-{i}"},
            )
        elif op == "refund100":
            client.post(
                f"/api/v1/payments/{pid}/refunds",
                json={"amount_minor": 100},
                headers={**auth, "Idempotency-Key": f"propops-{n}-ref-{i}"},
            )
        else:
            client.get(f"/api/v1/payments/{pid}", headers=auth)
    p = client.get(f"/api/v1/payments/{pid}", headers=auth).json()
    assert p["refunded_amount_minor"] <= p["captured_amount_minor"]
    assert p["status"] in (
        "CREATED",
        "AUTHORIZED",
        "CAPTURED",
        "PARTIALLY_REFUNDED",
        "REFUNDED",
        "DECLINED",
        "CANCELED",
    )

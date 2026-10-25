import pytest

from app.domain.errors import AppError
from app.domain.payments.rules import validate_amount, validate_currency
from app.domain.payments.states import can
from app.domain.refunds.rules import refundable_amount, validate_refund
from app.services.idempotency_service import request_hash
from app.services.webhook_service import BACKOFF
from scripts.webhook_receiver import DedupStore


def test_hash_is_canonical():
    assert request_hash({"a": 1, "b": 2}) == request_hash({"b": 2, "a": 1})
    assert request_hash({"a": 1}) != request_hash({"a": 2})


def test_state_machine():
    assert (
        can("authorize_ok", "CREATED")
        and can("capture", "AUTHORIZED")
        and can("refund_full", "CAPTURED")
    )
    assert not can("capture", "CREATED") and not can("refund_full", "AUTHORIZED")


def test_money_rules():
    validate_amount(1)
    validate_currency("USD")
    validate_currency("JPY")
    with pytest.raises(AppError):
        validate_amount(0)
    with pytest.raises(AppError):
        validate_amount(-100)
    with pytest.raises(AppError):
        validate_currency("INR")


def test_refund_rules():
    assert refundable_amount(10000, 7000) == 3000
    validate_refund(3000, 10000, 7000)
    with pytest.raises(AppError):
        validate_refund(3001, 10000, 7000)


def test_backoff_policy():
    assert BACKOFF == [0, 5, 15, 45, 120]


def test_dedup_store():
    s = DedupStore()
    assert not s.is_duplicate("e1")
    s.mark("e1")
    assert s.is_duplicate("e1")
    assert not s.is_duplicate("e2")


def test_url_validation_modes():
    from app.config import settings
    from app.infrastructure.url_validation import validate_webhook_url

    validate_webhook_url("http://127.0.0.1:9999/hook")  # development default allows private
    old = settings.allow_private_webhooks
    settings.allow_private_webhooks = False
    try:
        with pytest.raises(AppError):
            validate_webhook_url("http://127.0.0.1:9999/hook")
        with pytest.raises(AppError):
            validate_webhook_url("http://localhost:9999/hook")
        with pytest.raises(AppError):
            validate_webhook_url("http://192.168.1.5/hook")
        with pytest.raises(AppError):
            validate_webhook_url("http://169.254.169.254/latest/meta-data")
        validate_webhook_url("https://8.8.8.8/hook")
        with pytest.raises(AppError):
            validate_webhook_url("ftp://example.com/hook")
    finally:
        settings.allow_private_webhooks = old


def test_pagination_cursor_roundtrip():
    from app.api.v1.pagination import decode_cursor, encode_cursor

    assert decode_cursor(encode_cursor("abc-123")) == "abc-123"
    assert decode_cursor("!!!not-base64!!!") is None

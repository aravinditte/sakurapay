from app.domain.errors import AppError


def refundable_amount(captured: int, refunded: int) -> int:
    return (captured or 0) - (refunded or 0)


def validate_refund(amount: int, captured: int, refunded: int):
    if amount <= 0:
        raise AppError("VALIDATION_ERROR", "amount_minor must be positive.", 422)
    remaining = refundable_amount(captured, refunded)
    if amount > remaining:
        raise AppError(
            "REFUND_EXCEEDS_CAPTURED", f"Refund exceeds refundable amount {remaining}.", 409
        )

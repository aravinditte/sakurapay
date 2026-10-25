from app.domain.errors import AppError

SUPPORTED_CURRENCIES = {"USD", "JPY"}


def validate_amount(amount):
    if not isinstance(amount, int) or isinstance(amount, bool) or amount <= 0:
        raise AppError(
            "VALIDATION_ERROR", "amount_minor must be a positive integer in minor units.", 422
        )


def validate_currency(currency):
    if currency not in SUPPORTED_CURRENCIES:
        raise AppError("VALIDATION_ERROR", "Unsupported currency. Supported: USD, JPY.", 422)

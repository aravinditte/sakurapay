from app.domain.errors import AppError


def assert_balanced(deltas):
    if len(deltas) < 2:
        raise AppError("LEDGER_UNBALANCED", "At least two entries required.", 500)
    if sum(deltas) != 0:
        raise AppError("LEDGER_UNBALANCED", "Ledger entries must sum to zero.", 500)

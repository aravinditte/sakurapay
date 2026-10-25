from app.domain.errors import AppError
from app.infrastructure.models import Account, LedgerEntry, LedgerTransaction


def get_or_create_account(db, owner_type, owner_id, currency, account_type):
    a = (
        db.query(Account)
        .filter_by(
            owner_type=owner_type, owner_id=owner_id, currency=currency, account_type=account_type
        )
        .first()
    )
    if not a:
        a = Account(
            owner_type=owner_type,
            owner_id=owner_id,
            currency=currency,
            account_type=account_type,
            balance_minor=0,
        )
        db.add(a)
        db.flush()
    return a


def post(db, tx_type, ref_type, ref_id, currency, deltas):
    # deltas: list of (account, signed_amount); must sum to zero
    from app.domain.ledger.invariants import assert_balanced

    assert_balanced([d for _, d in deltas])
    existing = (
        db.query(LedgerTransaction)
        .filter_by(transaction_type=tx_type, reference_type=ref_type, reference_id=ref_id)
        .first()
    )
    if existing:
        raise AppError(
            "LEDGER_DUPLICATE", "Ledger transaction already posted for this operation.", 409
        )
    tx = LedgerTransaction(
        transaction_type=tx_type, reference_type=ref_type, reference_id=ref_id, currency=currency
    )
    db.add(tx)
    db.flush()
    for acct, delta in sorted(deltas, key=lambda x: x[0].id):
        db.add(
            LedgerEntry(ledger_transaction_id=tx.id, account_id=acct.id, amount_delta_minor=delta)
        )
        acct.balance_minor = (acct.balance_minor or 0) + delta
    return tx

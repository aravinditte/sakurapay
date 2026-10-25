from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.v1.pagination import paginate
from app.dependencies import current_user
from app.domain.errors import AppError
from app.infrastructure import models as m
from app.infrastructure.database import get_db

router = APIRouter(prefix="/ledger", tags=["ledger"])


@router.get("/transactions/{tx_id}")
def get_tx(tx_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    tx = db.query(m.LedgerTransaction).filter_by(id=tx_id).first()
    if not tx:
        raise AppError("NOT_FOUND", "Ledger transaction not found.", 404)
    entries = db.query(m.LedgerEntry).filter_by(ledger_transaction_id=tx.id).all()
    return {
        "id": tx.id,
        "transaction_type": tx.transaction_type,
        "reference_type": tx.reference_type,
        "reference_id": tx.reference_id,
        "currency": tx.currency,
        "status": tx.status,
        "entries": [
            {"account_id": e.account_id, "amount_delta_minor": e.amount_delta_minor}
            for e in entries
        ],
        "sum": sum(e.amount_delta_minor for e in entries),
    }


@router.get("/transactions")
def list_tx(
    limit: int = Query(50, le=100),
    cursor: str | None = Query(None),
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    txs, next_cursor = paginate(
        db, db.query(m.LedgerTransaction), m.LedgerTransaction, limit, cursor
    )
    return {
        "items": [
            {
                "id": t.id,
                "transaction_type": t.transaction_type,
                "reference_id": t.reference_id,
                "currency": t.currency,
            }
            for t in txs
        ],
        "next_cursor": next_cursor,
    }


@router.get("/accounts")
def list_accounts(user=Depends(current_user), db: Session = Depends(get_db)):
    accts = db.query(m.Account).all()
    return {
        "items": [
            {
                "id": a.id,
                "owner_type": a.owner_type,
                "owner_id": a.owner_id,
                "currency": a.currency,
                "account_type": a.account_type,
                "balance_minor": a.balance_minor,
            }
            for a in accts
        ]
    }

import datetime

from sqlalchemy import func

from app.infrastructure import models as m

STALE_MINUTES = 15


def run(db):
    disc = []

    def add(type_, rid, sev, detail):
        disc.append(
            {
                "type": type_,
                "resource_id": rid,
                "severity": sev,
                "detail": detail,
                "suggested_action": "Investigate the affected resource; do not edit historical ledger records. Use a compensating transaction if a correction is approved.",
            }
        )

    txs = db.query(m.LedgerTransaction).all()
    inspected = len(txs)
    failed_types = set()
    # 1 balanced entries + 2 currency match
    for tx in txs:
        entries = db.query(m.LedgerEntry).filter_by(ledger_transaction_id=tx.id).all()
        s = sum(e.amount_delta_minor for e in entries)
        if s != 0:
            add("LEDGER_UNBALANCED", tx.id, "HIGH", f"Entries sum to {s}, expected 0.")
            failed_types.add("balanced")
        for e in entries:
            acct = db.query(m.Account).filter_by(id=e.account_id).first()
            if acct and acct.currency != tx.currency:
                add(
                    "LEDGER_CURRENCY_MISMATCH",
                    tx.id,
                    "HIGH",
                    f"Entry account currency {acct.currency} != transaction currency {tx.currency}.",
                )
                failed_types.add("currency")
    # 7 duplicate postings (also prevented by unique constraint; checked independently)
    seen = {}
    for tx in txs:
        k = (tx.transaction_type, tx.reference_type, tx.reference_id)
        if k in seen:
            add("DUPLICATE_POSTING", tx.id, "HIGH", f"Duplicate posting for {k}.")
            failed_types.add("duplicate")
        seen[k] = tx.id
    accts = db.query(m.Account).all()
    inspected += len(accts)
    # 6 materialized vs derived
    for a in accts:
        derived = (
            db.query(func.coalesce(func.sum(m.LedgerEntry.amount_delta_minor), 0))
            .filter_by(account_id=a.id)
            .scalar()
        )
        if derived != a.balance_minor:
            add(
                "BALANCE_MISMATCH",
                a.id,
                "HIGH",
                f"Materialized {a.balance_minor} != ledger-derived {derived}.",
            )
            failed_types.add("balances")
    pays = db.query(m.Payment).all()
    inspected += len(pays)
    for p in pays:
        # 5 over-refund
        if (p.refunded_amount_minor or 0) > (p.captured_amount_minor or 0):
            add("OVER_REFUND", p.id, "HIGH", "Refunds exceed captured amount.")
            failed_types.add("over_refund")
        # 3 capture posting + 8 outbox existence
        if p.status in ("CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"):
            if (
                not db.query(m.LedgerTransaction)
                .filter_by(reference_type="payment", reference_id=p.id, transaction_type="CAPTURE")
                .first()
            ):
                add(
                    "MISSING_CAPTURE_LEDGER",
                    p.id,
                    "MEDIUM",
                    "Captured payment has no capture ledger posting.",
                )
                failed_types.add("capture_posting")
            if (
                not db.query(m.OutboxEvent)
                .filter_by(aggregate_id=p.id, event_type="payment.captured.v1")
                .first()
            ):
                add(
                    "MISSING_OUTBOX_EVENT",
                    p.id,
                    "MEDIUM",
                    "Captured payment has no payment.captured.v1 outbox event.",
                )
                failed_types.add("outbox")
    # 4 refund postings
    for r in db.query(m.Refund).filter_by(status="SUCCEEDED").all():
        if (
            not db.query(m.LedgerTransaction)
            .filter_by(reference_type="refund", reference_id=r.id, transaction_type="REFUND")
            .first()
        ):
            add(
                "MISSING_REFUND_LEDGER",
                r.id,
                "MEDIUM",
                "Successful refund has no compensating ledger posting.",
            )
            failed_types.add("refund_posting")
    # 9 stale pending operations
    cutoff = datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=STALE_MINUTES)
    for op in db.query(m.PaymentOperation).filter_by(status="PENDING").all():
        created = op.created_at
        if (
            created
            and (created.replace(tzinfo=datetime.UTC) if created.tzinfo is None else created)
            < cutoff
        ):
            add(
                "STALE_PENDING_OPERATION", op.id, "LOW", "Operation pending longer than 15 minutes."
            )
            failed_types.add("stale")
    # 10 exhausted webhooks
    failed_deliveries = db.query(m.WebhookDelivery).filter_by(status="EXHAUSTED").count()
    if failed_deliveries:
        add("WEBHOOK_EXHAUSTED", None, "LOW", f"{failed_deliveries} exhausted webhook deliveries.")
        failed_types.add("webhooks")
    CHECK_GROUPS = {
        "balanced",
        "currency",
        "duplicate",
        "balances",
        "over_refund",
        "capture_posting",
        "refund_posting",
        "outbox",
        "stale",
        "webhooks",
    }
    run_rec = m.ReconciliationRun(
        records_inspected=inspected,
        checks_passed=len(CHECK_GROUPS - failed_types),
        checks_failed=len(disc),
        discrepancies=disc,
    )
    run_rec.completed_at = datetime.datetime.now(datetime.UTC)
    db.add(run_rec)
    db.commit()
    return run_rec

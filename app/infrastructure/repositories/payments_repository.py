from app.infrastructure import models as m


def get_by_id(db, payment_id):
    return db.query(m.Payment).filter_by(id=payment_id).first()


def lock_by_id(db, payment_id):
    q = db.query(m.Payment).filter_by(id=payment_id)
    try:
        return q.with_for_update().first()
    except Exception:
        return q.first()

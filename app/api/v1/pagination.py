import base64


def encode_cursor(row_id: str) -> str:
    return base64.urlsafe_b64encode(row_id.encode()).decode()


def decode_cursor(cursor: str):
    try:
        return base64.urlsafe_b64decode(cursor.encode()).decode()
    except Exception:
        return None


def paginate(db, query, model, limit, cursor):
    """Stable ordering: created_at DESC, id DESC. The cursor is the id of the last row of the
    previous page; the anchor row is loaded so datetime comparisons use DB-native values."""
    q = query.order_by(model.created_at.desc(), model.id.desc())
    if cursor:
        anchor_id = decode_cursor(cursor)
        anchor = db.query(model).filter_by(id=anchor_id).first() if anchor_id else None
        if anchor is not None:
            from sqlalchemy import and_, or_

            q = q.filter(
                or_(
                    model.created_at < anchor.created_at,
                    and_(model.created_at == anchor.created_at, model.id < anchor.id),
                )
            )
    rows = q.limit(limit + 1).all()
    next_cursor = None
    if len(rows) > limit:
        next_cursor = encode_cursor(rows[limit - 1].id)
        rows = rows[:limit]
    return rows, next_cursor

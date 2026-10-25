from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.domain.errors import AppError
from app.infrastructure import models as m
from app.infrastructure.database import get_db
from app.infrastructure.security import decode_token


def current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)):
    if not authorization.startswith("Bearer "):
        raise AppError("UNAUTHORIZED", "Authentication required.", 401)
    try:
        data = decode_token(authorization[7:])
    except Exception:
        raise AppError("UNAUTHORIZED", "Invalid or expired token.", 401)
    u = db.query(m.User).filter_by(id=data["sub"]).first()
    if not u or not u.is_active:
        raise AppError("UNAUTHORIZED", "User not found or inactive.", 401)
    return u


def current_merchant(user=Depends(current_user), db: Session = Depends(get_db)):
    mer = db.query(m.Merchant).filter_by(owner_user_id=user.id).first()
    if not mer:
        if user.role == "ADMIN":
            raise AppError(
                "FORBIDDEN",
                "Admin has no merchant account; register a merchant user for payments.",
                403,
            )
        raise AppError("FORBIDDEN", "No merchant account for this user.", 403)
    return mer

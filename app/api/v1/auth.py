from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import current_user
from app.domain.errors import AppError
from app.infrastructure import models as m
from app.infrastructure.database import get_db
from app.infrastructure.security import create_token, hash_password, verify_password
from app.schemas.common import LoginIn, RegisterIn

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if db.query(m.User).filter_by(email=body.email.lower()).first():
        raise AppError("EMAIL_EXISTS", "Email already registered.", 409)
    u = m.User(email=body.email.lower(), password_hash=hash_password(body.password), role=body.role)
    db.add(u)
    db.flush()
    mer = None
    if body.role != "ADMIN":
        mer = m.Merchant(owner_user_id=u.id, name=body.merchant_name)
        db.add(mer)
    db.commit()
    tok, exp = create_token(u.id, u.role, u.email)
    return {
        "access_token": tok,
        "token_type": "bearer",
        "expires_in": exp,
        "user_id": u.id,
        "merchant_id": mer.id if mer else None,
    }


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = db.query(m.User).filter_by(email=body.email.lower()).first()
    if not u or not verify_password(u.password_hash, body.password):
        raise AppError("UNAUTHORIZED", "Invalid email or password.", 401)
    tok, exp = create_token(u.id, u.role, u.email)
    return {"access_token": tok, "token_type": "bearer", "expires_in": exp}


@router.get("/me")
def me(user=Depends(current_user), db: Session = Depends(get_db)):
    mer = db.query(m.Merchant).filter_by(owner_user_id=user.id).first()
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "merchant_id": mer.id if mer else None,
    }

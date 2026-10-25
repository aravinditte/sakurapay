import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import app.infrastructure.models as m
from app.infrastructure.database import Base, SessionLocal, engine
from app.infrastructure.security import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()


def ensure(email, pw, role, shop=None):
    u = db.query(m.User).filter_by(email=email).first()
    if not u:
        u = m.User(email=email, password_hash=hash_password(pw), role=role)
        db.add(u)
        db.flush()
        if shop:
            db.add(m.Merchant(owner_user_id=u.id, name=shop))
        db.commit()
        print(f"created {email} / {pw} ({role})")
    else:
        print(f"exists {email}")


ensure("merchant@example.test", "demo-password", "MERCHANT", "Demo Shop")
ensure("admin@example.test", "admin-password", "ADMIN")
print("Seed done. Login via POST /api/v1/auth/login")

import datetime
import hashlib
import hmac

import jwt
from argon2 import PasswordHasher

from app.config import settings

ph = PasswordHasher()


def hash_password(p):
    return ph.hash(p)


def verify_password(h, p):
    try:
        return ph.verify(h, p)
    except Exception:
        return False


def create_token(user_id, role, email):
    exp = datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=settings.jwt_minutes)
    return jwt.encode(
        {"sub": user_id, "role": role, "email": email, "exp": exp},
        settings.jwt_secret,
        algorithm="HS256",
    ), settings.jwt_minutes * 60


def decode_token(t):
    return jwt.decode(t, settings.jwt_secret, algorithms=["HS256"])


def sign_webhook(secret, timestamp, body_bytes):
    msg = f"{timestamp}.".encode() + body_bytes
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


def verify_webhook(secret, timestamp, body_bytes, sig):
    return hmac.compare_digest(sign_webhook(secret, timestamp, body_bytes), sig)

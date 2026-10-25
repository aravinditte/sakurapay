import time

from app.infrastructure.database import SessionLocal
from app.services.webhook_service import process_outbox


def run_once():
    db = SessionLocal()
    try:
        return process_outbox(db)
    finally:
        db.close()


def run_forever(interval=2):
    while True:
        try:
            run_once()
        except Exception as e:
            print("outbox worker error:", e)
        time.sleep(interval)

import sys

sys.path.insert(0, ".")
from app.infrastructure.database import SessionLocal
from app.services.reconciliation_service import run

db = SessionLocal()
r = run(db)
print(r.id, r.checks_passed, r.checks_failed, r.discrepancies)

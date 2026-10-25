from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import current_user
from app.domain.errors import AppError
from app.infrastructure import models as m
from app.infrastructure.database import get_db
from app.services.reconciliation_service import run as run_recon

router = APIRouter(prefix="/admin", tags=["reconciliation"])


def require_admin(user):
    if user.role != "ADMIN":
        raise AppError("FORBIDDEN", "Admin role required.", 403)


@router.post("/reconciliation-runs", status_code=201)
def create_run(user=Depends(current_user), db: Session = Depends(get_db)):
    require_admin(user)
    r = run_recon(db)
    return {
        "id": r.id,
        "status": r.status,
        "records_inspected": r.records_inspected,
        "checks_passed": r.checks_passed,
        "checks_failed": r.checks_failed,
        "discrepancies": r.discrepancies,
    }


@router.get("/reconciliation-runs/{run_id}")
def get_run(run_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    require_admin(user)
    r = db.query(m.ReconciliationRun).filter_by(id=run_id).first()
    if not r:
        raise AppError("NOT_FOUND", "Run not found.", 404)
    return {
        "id": r.id,
        "status": r.status,
        "records_inspected": r.records_inspected,
        "checks_passed": r.checks_passed,
        "checks_failed": r.checks_failed,
        "discrepancies": r.discrepancies,
    }

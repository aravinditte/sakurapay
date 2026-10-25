from fastapi import APIRouter

from app.api.v1 import auth, ledger, payments, reconciliation, refunds, webhooks

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(payments.router)
api_router.include_router(refunds.router)
api_router.include_router(ledger.router)
api_router.include_router(webhooks.router)
api_router.include_router(reconciliation.router)

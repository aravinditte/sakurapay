import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

import app.infrastructure.models
from app.api.v1.router import api_router
from app.config import settings
from app.domain.errors import AppError
from app.infrastructure.database import Base, engine
from app.observability.logging import setup as log_setup
from app.ratelimit import limiter

log_setup()
if settings.auto_create_tables:
    Base.metadata.create_all(bind=engine)
app = FastAPI(
    title="SakuraPay",
    version="0.2.0",
    description="Payment Processing Reliability Simulator - simulated only, no real money.",
)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.middleware("http")
async def req_context(request: Request, call_next):
    rid = str(uuid.uuid4())
    request.state.request_id = rid
    start = time.time()
    bucket = "auth" if request.url.path.startswith("/api/v1/auth/") else "general"
    limit = (
        settings.auth_rate_limit_per_minute if bucket == "auth" else settings.rate_limit_per_minute
    )
    client_ip = request.client.host if request.client else "unknown"
    if request.url.path.startswith("/api/") and not limiter.allow(f"{client_ip}:{bucket}", limit):
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": "RATE_LIMITED",
                    "message": "Rate limit exceeded. Retry later.",
                    "request_id": rid,
                }
            },
            headers={"X-Request-Id": rid},
        )
    response = await call_next(request)
    response.headers["X-Request-Id"] = rid
    logging.getLogger("sakurapay").info(
        "%s %s -> %s",
        request.method,
        request.url.path,
        response.status_code,
        extra={"request_id": rid, "duration_ms": round((time.time() - start) * 1000, 2)},
    )
    return response


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "request_id": getattr(request.state, "request_id", ""),
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    msg = (
        f"{'.'.join(str(p) for p in first.get('loc', []))}: {first.get('msg', 'Invalid request.')}"
    )
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": msg,
                "request_id": getattr(request.state, "request_id", ""),
            }
        },
    )


@app.get("/health/live")
def live():
    return {"status": "ok"}


@app.get("/health/ready")
def ready():
    from sqlalchemy import text

    from app.infrastructure.database import SessionLocal

    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "not_ready"})
    finally:
        db.close()


@app.get("/health/worker")
def worker_health():
    from app.infrastructure import models as m
    from app.infrastructure.database import SessionLocal

    db = SessionLocal()
    try:
        pending = db.query(m.OutboxEvent).filter(m.OutboxEvent.published_at.is_(None)).count()
        pending_deliveries = db.query(m.WebhookDelivery).filter_by(status="PENDING").count()
        exhausted = db.query(m.WebhookDelivery).filter_by(status="EXHAUSTED").count()
        return {
            "status": "ok",
            "unpublished_outbox_events": pending,
            "pending_deliveries": pending_deliveries,
            "exhausted_deliveries": exhausted,
        }
    finally:
        db.close()


import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

dist_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "landing", "dist")
if os.path.isdir(os.path.join(dist_dir, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="landing_assets")
hls_dir = os.path.join(dist_dir, "hls")
if not os.path.isdir(hls_dir):
    hls_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "landing", "public", "hls")
if os.path.isdir(hls_dir):
    app.mount("/hls", StaticFiles(directory=hls_dir), name="landing_hls")

@app.get("/")
def root():
    dist_index = os.path.join(dist_dir, "index.html")
    if os.path.exists(dist_index):
        return FileResponse(dist_index, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    return {"name": "SakuraPay", "docs": "/docs", "health": "/health/live"}

@app.get("/classic")
def classic():
    classic_index = os.path.join(os.path.dirname(os.path.dirname(__file__)), "index.html")
    if os.path.exists(classic_index):
        return FileResponse(classic_index, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    return {"error": "index.html not found"}

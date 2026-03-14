"""FastAPI entry point for the refactored scheduling backend."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .api.email import router as email_router
from .api.integrity import router as integrity_router
from .api.restaurant import router as restaurant_router
from .api.schedule import router as schedule_router
from .core.settings import get_settings
from .services.config_store import DATA_DIR


@asynccontextmanager
async def lifespan(_: FastAPI):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        from .db.database import create_tables
    except ModuleNotFoundError:
        create_tables = None
    if create_tables is not None:
        try:
            create_tables()
        except Exception:
            # Startup should not crash local development when DB is unreachable.
            pass
    yield


settings = get_settings()
app = FastAPI(title="Acquerello Scheduler Backend", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials="*" not in settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(restaurant_router, prefix="/api")
app.include_router(schedule_router, prefix="/api")
app.include_router(integrity_router, prefix="/api")
app.include_router(email_router, prefix="/api")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "environment": settings.app_env,
        "integrity_mode": settings.integrity_check_mode,
    }


@app.get("/ready")
def ready():
    data = {
        "status": "ok",
        "checks": {
            "data_dir": DATA_DIR.exists(),
            "integrity_configured": settings.integrity_configured,
            "email_configured": bool(settings.resend_api_key),
            "s3_configured": settings.s3_configured,
            "openpyxl_available": _module_available("openpyxl"),
            "sqlalchemy_available": _module_available("sqlalchemy"),
        },
    }
    if settings.integrity_check_mode == "required" and not settings.integrity_configured:
        data["status"] = "degraded"
        return JSONResponse(status_code=503, content=data)
    return data


def _module_available(name: str) -> bool:
    try:
        __import__(name)
    except ModuleNotFoundError:
        return False
    return True

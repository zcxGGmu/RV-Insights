from __future__ import annotations

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import settings
from .database import DatabaseManager
from .api.router import api_router

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database connections on startup
    # Reuse pre-set db_manager (e.g., in tests) if provided
    db_manager = getattr(app.state, "db_manager", None)
    if db_manager is None:
        db_manager = DatabaseManager()
        app.state.db_manager = db_manager
    await db_manager.connect_all()
    logger.info("RV-Insights startup", app=settings.APP_NAME, version=settings.APP_VERSION)
    try:
        yield
    finally:
        await db_manager.disconnect_all()
        logger.info("RV-Insights shutdown")


app = FastAPI(title="RV-Insights API", version=settings.APP_VERSION, lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
)

# Routers
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    db_manager = getattr(app.state, "db_manager", None)
    if db_manager is None:
        return {
            "status": "ok",
            "version": settings.APP_VERSION,
            "services": {
                "mongodb": "disconnected",
                "postgres": "disconnected",
                "redis": "disconnected",
            },
        }
    services = await db_manager.health_check()
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "services": {
            "mongodb": services.get("mongodb", "disconnected"),
            "postgres": services.get("postgres", "disconnected"),
            "redis": services.get("redis", "disconnected"),
        },
    }

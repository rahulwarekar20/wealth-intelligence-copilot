from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth
from app.api import portfolio
from app.api import evidence
from app.api import decisions
from app.api import documents
from app.core.config import settings
from app.core.startup import check_production_readiness
import logging
import threading

import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("wealth-copilot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create any tables that don't exist yet (e.g. "documents" on an older
    # database). Existing tables are never altered or dropped.
    from app.core.db import Base, engine
    from app.models import models  # noqa: F401 -- registers models
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.error("Could not create missing tables: %s", e)

    # Preload the SEC ticker list in the background so the first question isn't slower
    def warm_sec_cache():
        try:
            from app.services.sec_service import lookup_cik
            lookup_cik("AAPL")
        except Exception as e:
            logger.warning("Could not preload SEC ticker list: %s", e)
    threading.Thread(target=warm_sec_cache, daemon=True).start()

    issues = check_production_readiness()
    if issues:
        logger.warning("=" * 60)
        logger.warning("STARTUP WARNINGS — review before production deployment:")
        for issue in issues:
            logger.warning("  ⚠️  %s", issue)
        logger.warning("=" * 60)
    else:
        logger.info("✅ Startup checks passed")
    yield


app = FastAPI(
    title="Wealth Intelligence Copilot",
    version="0.1.0",
    lifespan=lifespan
)

# ── CORS ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Security Headers Middleware ──────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    # HSTS is only meaningful (and only honoured) over HTTPS
    forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    if forwarded_proto == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# ── Routers ─────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(portfolio.router)
app.include_router(evidence.router)
app.include_router(decisions.router)
app.include_router(documents.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "wealth-copilot-backend", "version": "0.1.0"}

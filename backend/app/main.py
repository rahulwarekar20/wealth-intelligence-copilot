from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api import auth
from app.api import portfolio
from app.api import evidence
from app.api import decisions
from app.api import documents
import logging
import os

logger = logging.getLogger("wealth-copilot")

app = FastAPI(
    title="Wealth Intelligence Copilot",
    version="0.1.0"
)

# ── CORS ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Security Headers Middleware ──────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# ── Startup self-check ───────────────────────────────────────────
@app.on_event("startup")
async def startup_checks():
    jwt_secret = os.getenv("JWT_SECRET", "")
    groq_key = os.getenv("GROQ_API_KEY", "")
    finnhub_key = os.getenv("FINNHUB_API_KEY", "")

    warnings = []
    if jwt_secret == "my_local_dev_secret_change_this_later":
        warnings.append("JWT_SECRET is still set to the default dev value")
    if not groq_key:
        warnings.append("GROQ_API_KEY is not set — AI agents will fail")
    if not finnhub_key:
        warnings.append("FINNHUB_API_KEY is not set — market data will fail")

    if warnings:
        logger.warning("=" * 60)
        logger.warning("STARTUP WARNINGS — review before production deployment:")
        for w in warnings:
            logger.warning(f"  ⚠️  {w}")
        logger.warning("=" * 60)
    else:
        logger.info("✅ Startup checks passed")

# ── Routers ─────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(portfolio.router)
app.include_router(evidence.router)
app.include_router(decisions.router)
app.include_router(documents.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "wealth-copilot-backend", "version": "0.1.0"}
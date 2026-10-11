"""
Production readiness checks.
Run at startup to catch configuration issues early.
"""
from app.core.config import settings


def check_production_readiness() -> list[str]:
    """
    Returns a list of issues found.
    Empty list means ready for production.
    """
    issues = []

    if not settings.GROQ_API_KEY:
        issues.append("GROQ_API_KEY is not set — AI agents will fail")
    if not settings.FINNHUB_API_KEY:
        issues.append("FINNHUB_API_KEY is not set — market data will fail")
    if not settings.ALPHA_VANTAGE_API_KEY:
        issues.append("ALPHA_VANTAGE_API_KEY is not set — correlation data will be unavailable")

    if "example.com" in settings.SEC_USER_AGENT or "@" not in settings.SEC_USER_AGENT:
        issues.append("SEC_USER_AGENT should contain your app name and a real contact email (SEC may block requests)")

    jwt_secret = settings.JWT_SECRET or ""
    lowered = jwt_secret.lower()
    if "dev" in lowered or "change" in lowered or "generate" in lowered:
        issues.append("JWT_SECRET appears to be a development placeholder")
    if len(jwt_secret) < 32:
        issues.append("JWT_SECRET should be at least 32 characters")

    if any("localhost" in o for o in settings.cors_origins) and len(settings.cors_origins) == 1:
        issues.append("CORS_ORIGINS only allows localhost — set it to your deployed frontend URL in production")

    return issues

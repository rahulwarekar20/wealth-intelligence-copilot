"""
Production readiness checks.
Run these before deployment to catch configuration issues early.
"""
import os
import logging

logger = logging.getLogger("wealth-copilot.startup")


def check_production_readiness() -> list[str]:
    """
    Returns a list of issues found.
    Empty list means ready for production.
    """
    issues = []

    required_vars = [
        "DATABASE_URL",
        "JWT_SECRET",
        "GROQ_API_KEY",
        "FINNHUB_API_KEY",
    ]

    for var in required_vars:
        if not os.getenv(var):
            issues.append(f"Missing required env var: {var}")

    jwt_secret = os.getenv("JWT_SECRET", "")
    if "dev" in jwt_secret.lower() or "change" in jwt_secret.lower():
        issues.append("JWT_SECRET appears to be a development placeholder")

    if len(jwt_secret) < 32:
        issues.append("JWT_SECRET should be at least 32 characters")

    return issues
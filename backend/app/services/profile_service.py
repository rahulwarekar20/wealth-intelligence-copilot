"""
Investor profile: risk tolerance, time horizon and the per-position
concentration limit, plus the user's other assets (cash, bonds, property).

Every agent reads the profile through get_profile(), so a missing profile
always falls back to the same defaults (moderate risk, 25% limit).
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.models import OtherAsset, User, UserProfile

RISK_LEVELS = ("conservative", "moderate", "aggressive")
ASSET_CLASSES = ("cash", "bonds", "property", "other")
DEFAULT_MAX_POSITION_PCT = 25.0
# "Medium" concentration starts at this share of the user's limit (25% limit -> 15%)
MEDIUM_SHARE_OF_LIMIT = 0.6


def concentration_limits(max_position_pct: float) -> dict:
    """High / medium concentration thresholds (in %) derived from the user's limit."""
    high = float(max_position_pct)
    return {"high": high, "medium": round(high * MEDIUM_SHARE_OF_LIMIT, 1)}


def concentration_flag(weight_pct: Optional[float], limits: dict) -> str:
    """HIGH / MEDIUM / LOW for a portfolio weight, using the user's thresholds."""
    if weight_pct is None:
        return "LOW"
    if weight_pct > limits["high"]:
        return "HIGH"
    if weight_pct > limits["medium"]:
        return "MEDIUM"
    return "LOW"


def get_profile(db: Session, user_id: str) -> dict:
    """The user's profile with defaults filled in, plus derived concentration limits."""
    user = db.query(User).filter(User.id == user_id).first()
    row = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    max_pct = float(row.max_position_pct) if row and row.max_position_pct is not None else DEFAULT_MAX_POSITION_PCT
    risk = user.risk_tolerance if user and user.risk_tolerance in RISK_LEVELS else "moderate"
    return {
        "risk_tolerance": risk,
        "horizon_years": row.horizon_years if row else None,
        "max_position_pct": max_pct,
        "limits": concentration_limits(max_pct),
        "is_set": row is not None,
    }


def update_profile(db: Session, user_id: str, risk_tolerance: str, horizon_years: Optional[int], max_position_pct: float) -> dict:
    """Saves the profile (creating it on first save) and returns the updated version."""
    user = db.query(User).filter(User.id == user_id).first()
    user.risk_tolerance = risk_tolerance
    row = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not row:
        row = UserProfile(user_id=user_id)
        db.add(row)
    row.horizon_years = horizon_years
    row.max_position_pct = max_position_pct
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    return get_profile(db, user_id)


def describe_profile(profile: dict) -> str:
    """One-line description of the profile for LLM prompts."""
    horizon = f"{profile['horizon_years']}-year horizon" if profile.get("horizon_years") else "horizon not stated"
    note = "" if profile.get("is_set") else " (defaults — the user has not set a profile)"
    return (f"{profile['risk_tolerance']} risk tolerance, {horizon}, "
            f"maximum {profile['max_position_pct']:g}% in any one position{note}")


# ── Other assets ─────────────────────────────────────────────────────────────

def list_assets(db: Session, user_id: str) -> list[OtherAsset]:
    """The user's other assets, largest first."""
    return (
        db.query(OtherAsset)
        .filter(OtherAsset.user_id == user_id)
        .order_by(OtherAsset.value.desc())
        .all()
    )


def add_asset(db: Session, user_id: str, name: str, asset_class: str, value: float) -> OtherAsset:
    """Saves a new asset and returns it."""
    asset = OtherAsset(user_id=user_id, name=name.strip(), asset_class=asset_class, value=value)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def delete_asset(db: Session, user_id: str, asset_id: str) -> bool:
    """Deletes one of the user's assets; False if it doesn't exist or isn't theirs."""
    asset = db.query(OtherAsset).filter(OtherAsset.id == asset_id, OtherAsset.user_id == user_id).first()
    if not asset:
        return False
    db.delete(asset)
    db.commit()
    return True


def assets_by_class(db: Session, user_id: str) -> dict:
    """Total value per asset class, e.g. {"cash": 20000.0, "property": 350000.0}."""
    totals: dict = {}
    for a in list_assets(db, user_id):
        totals[a.asset_class] = totals.get(a.asset_class, 0.0) + float(a.value)
    return totals


def describe_other_assets(db: Session, user_id: str) -> str:
    """Other assets as prompt text, e.g. 'cash $20,000; property $350,000', or 'none recorded'."""
    totals = assets_by_class(db, user_id)
    if not totals:
        return "none recorded"
    return "; ".join(f"{cls} ${value:,.0f}" for cls, value in totals.items())

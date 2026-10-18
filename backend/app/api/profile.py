"""
Profile endpoints: the investor profile (risk tolerance, horizon, position
limit) and other assets (cash, bonds, property) that make up net worth.
"""
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.services import profile_service

router = APIRouter(tags=["profile"])


class ProfileIn(BaseModel):
    """Profile update. The position limit must leave room for diversification (5–100%)."""
    risk_tolerance: Literal["conservative", "moderate", "aggressive"]
    horizon_years: Optional[int] = Field(default=None, ge=0, le=80)
    max_position_pct: float = Field(ge=5, le=100)


class AssetIn(BaseModel):
    """A new asset outside the stock holdings."""
    name: str = Field(min_length=1, max_length=80)
    asset_class: Literal["cash", "bonds", "property", "other"]
    value: float = Field(ge=0, le=1e12)


def _asset_out(a) -> dict:
    """API view of an asset."""
    return {"id": str(a.id), "name": a.name, "asset_class": a.asset_class, "value": float(a.value)}


@router.get("/profile")
def get_profile(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """The user's profile (defaults when never saved; `is_set` says which)."""
    return profile_service.get_profile(db, user_id)


@router.put("/profile")
def save_profile(payload: ProfileIn, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """Saves the profile and returns it, including the derived concentration limits."""
    return profile_service.update_profile(
        db, user_id, payload.risk_tolerance, payload.horizon_years, payload.max_position_pct
    )


@router.get("/assets")
def list_assets(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """The user's other assets and their total."""
    assets = profile_service.list_assets(db, user_id)
    return {"assets": [_asset_out(a) for a in assets], "total": round(sum(float(a.value) for a in assets), 2)}


@router.post("/assets")
def add_asset(payload: AssetIn, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """Adds an asset."""
    return _asset_out(profile_service.add_asset(db, user_id, payload.name, payload.asset_class, payload.value))


@router.delete("/assets/{asset_id}")
def delete_asset(asset_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """Deletes one of the user's assets; 404 if it isn't theirs or doesn't exist."""
    try:
        uuid.UUID(asset_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not profile_service.delete_asset(db, user_id, asset_id):
        raise HTTPException(status_code=404, detail="Asset not found")
    return {"message": "Asset deleted"}

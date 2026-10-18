"""Pydantic request/response models shared by the API routers."""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserSignup(BaseModel):
    """Sign-up request: valid email, password 8–72 characters."""
    email: EmailStr
    # bcrypt only uses the first 72 bytes of a password
    password: str = Field(min_length=8, max_length=72)


class UserLogin(BaseModel):
    """Login request."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT returned after sign-up or login; send it as 'Authorization: Bearer <token>'."""
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    """Public profile of a user (no password hash)."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    risk_tolerance: str


class HoldingCreate(BaseModel):
    """New holding: ticker, positive quantity, optional non-negative cost per share, account type."""
    ticker: str = Field(min_length=1, max_length=10)
    quantity: float = Field(gt=0)
    cost_basis: Optional[float] = Field(default=None, ge=0)
    account_type: str = Field(default="taxable", max_length=30)


class HoldingOut(BaseModel):
    """A stored holding (without live prices)."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticker: str
    quantity: float
    cost_basis: Optional[float]
    account_type: str


class PortfolioSummary(BaseModel):
    """Valued portfolio: total, holdings, concentration per ticker, optional correlation."""
    total_value: float
    holdings: list[HoldingOut]
    concentration: dict
    correlation: dict


class EvidenceItemOut(BaseModel):
    """One cached evidence item (news, fundamentals or price data) for a ticker."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticker: str
    source_type: str
    payload: dict
    reliability_weight: float
    retrieved_at: str


class EvidenceSummary(BaseModel):
    """All current evidence for a ticker, as returned by GET /evidence/{ticker}."""
    ticker: str
    price_data: dict
    news_sentiment: dict
    fundamentals: dict
    evidence_items: list[EvidenceItemOut]
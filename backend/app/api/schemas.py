from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserSignup(BaseModel):
    email: EmailStr
    # bcrypt only uses the first 72 bytes of a password
    password: str = Field(min_length=8, max_length=72)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    risk_tolerance: str


class HoldingCreate(BaseModel):
    ticker: str = Field(min_length=1, max_length=10)
    quantity: float = Field(gt=0)
    cost_basis: Optional[float] = Field(default=None, ge=0)
    account_type: str = Field(default="taxable", max_length=30)


class HoldingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticker: str
    quantity: float
    cost_basis: Optional[float]
    account_type: str


class PortfolioSummary(BaseModel):
    total_value: float
    holdings: list[HoldingOut]
    concentration: dict
    correlation: dict


class EvidenceItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticker: str
    source_type: str
    payload: dict
    reliability_weight: float
    retrieved_at: str


class EvidenceSummary(BaseModel):
    ticker: str
    price_data: dict
    news_sentiment: dict
    fundamentals: dict
    evidence_items: list[EvidenceItemOut]
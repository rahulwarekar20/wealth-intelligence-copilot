from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class UserSignup(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: str
    email: EmailStr
    risk_tolerance: str

    class Config:
        from_attributes = True

        # ── Portfolio schemas ──────────────────────────────────────────

class HoldingCreate(BaseModel):
    ticker: str
    quantity: float = Field(gt=0)
    cost_basis: Optional[float] = None
    account_type: str = "taxable"

class HoldingOut(BaseModel):
    id: str
    ticker: str
    quantity: float
    cost_basis: Optional[float]
    account_type: str

    class Config:
        from_attributes = True

class PortfolioSummary(BaseModel):
    total_value: float
    holdings: list[HoldingOut]
    concentration: dict
    correlation: dict

    # ── Evidence schemas ────────────────────────────────────────────

class EvidenceItemOut(BaseModel):
    id: str
    ticker: str
    source_type: str
    payload: dict
    reliability_weight: float
    retrieved_at: str

    class Config:
        from_attributes = True

class EvidenceSummary(BaseModel):
    ticker: str
    price_data: dict
    news_sentiment: dict
    fundamentals: dict
    evidence_items: list[EvidenceItemOut]
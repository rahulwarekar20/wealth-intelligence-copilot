"""Evidence endpoint: the stored evidence items for a ticker."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import get_current_user_id
from app.services.evidence_service import gather_evidence

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.get("/{ticker}")
def get_evidence(
    ticker: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Gather all evidence for a ticker:
    - Live price and trend
    - Recent news sentiment
    - Company fundamentals
    All evidence is saved to the database for the multi-agent layer.
    """
    if not ticker or len(ticker) > 10:
        raise HTTPException(status_code=400, detail="Invalid ticker symbol")

    evidence = gather_evidence(ticker.upper(), db)
    return evidence
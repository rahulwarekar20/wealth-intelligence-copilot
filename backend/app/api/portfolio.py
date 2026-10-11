import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import get_current_user_id
from app.api.schemas import HoldingCreate, HoldingOut, PortfolioSummary
from app.repositories.portfolio_repository import (
    get_holdings,
    get_holding_by_id,
    create_holding,
    delete_holding
)
from app.services.portfolio_service import compute_portfolio_summary

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.post("/holdings", response_model=HoldingOut)
def add_holding(
    payload: HoldingCreate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Add a new holding to the user's portfolio."""
    holding = create_holding(
        db=db,
        user_id=user_id,
        ticker=payload.ticker,
        quantity=payload.quantity,
        cost_basis=payload.cost_basis,
        account_type=payload.account_type
    )
    return HoldingOut(
        id=str(holding.id),
        ticker=holding.ticker,
        quantity=float(holding.quantity),
        cost_basis=float(holding.cost_basis) if holding.cost_basis is not None else None,
        account_type=holding.account_type
    )


@router.get("/holdings", response_model=list[HoldingOut])
def list_holdings(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List all holdings for the authenticated user."""
    holdings = get_holdings(db, user_id)
    return [
        HoldingOut(
            id=str(h.id),
            ticker=h.ticker,
            quantity=float(h.quantity),
            cost_basis=float(h.cost_basis) if h.cost_basis is not None else None,
            account_type=h.account_type
        )
        for h in holdings
    ]


@router.delete("/holdings/{holding_id}")
def remove_holding(
    holding_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete a holding from the user's portfolio."""
    try:
        uuid.UUID(holding_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Holding not found")
    deleted = delete_holding(db, holding_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {"message": "Holding deleted successfully"}


@router.get("/summary")
def portfolio_summary(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Core portfolio-aware endpoint:
    Returns live prices, total value, concentration per position,
    and pairwise correlation across all holdings.
    """
    summary = compute_portfolio_summary(db, user_id)
    return summary
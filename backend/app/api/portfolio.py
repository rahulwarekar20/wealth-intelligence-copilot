"""
Portfolio endpoints: add, list and delete holdings, import holdings from a
brokerage file (preview, then confirm), and the live portfolio summary.
"""

import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.agents.llm_client import LLMError
from app.core.db import get_db
from app.core.security import get_current_user_id
from app.api.schemas import HoldingCreate, HoldingOut, PortfolioSummary
from app.repositories.portfolio_repository import (
    get_holdings,
    get_holding_by_id,
    create_holding,
    delete_holding
)
from app.services.document_service import MAX_UPLOAD_BYTES, DocumentError
from app.services.import_service import MAX_ROWS, parse_holdings_file
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
    include_correlation: bool = False,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Core portfolio-aware endpoint:
    Returns live prices, total value and concentration per position.
    Pass ?include_correlation=true for pairwise correlation across holdings
    (slower: needs historical prices for every ticker).
    """
    summary = compute_portfolio_summary(db, user_id, include_correlation=include_correlation)
    return summary

class ImportRequest(BaseModel):
    """Holdings confirmed by the user after the import preview."""
    holdings: list[HoldingCreate] = Field(min_length=1, max_length=MAX_ROWS)
    # True replaces every existing holding (re-importing a full statement); False adds to them
    replace: bool = False


@router.post("/import/preview")
async def preview_import(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """
    Reads holdings from a brokerage CSV or PDF statement without saving them.
    Returns {"holdings": [...], "method": "csv" | "ai"} for the user to review.
    """
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
    if not data:
        raise HTTPException(status_code=400, detail="File is empty")
    try:
        return parse_holdings_file(file.filename or "holdings", file.content_type, data)
    except (DocumentError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LLMError as e:
        raise HTTPException(status_code=502, detail=f"Could not read the statement: {e}")


@router.post("/import")
def confirm_import(
    payload: ImportRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Saves the confirmed holdings, optionally replacing all existing ones."""
    if payload.replace:
        for h in get_holdings(db, user_id):
            db.delete(h)
        db.commit()
    for h in payload.holdings:
        create_holding(db=db, user_id=user_id, ticker=h.ticker, quantity=h.quantity,
                       cost_basis=h.cost_basis, account_type=h.account_type)
    return {"imported": len(payload.holdings), "replaced": payload.replace}

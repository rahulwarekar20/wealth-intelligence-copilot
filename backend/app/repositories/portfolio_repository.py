"""Holdings queries, always scoped to the owning user."""

from sqlalchemy.orm import Session
from app.models.models import Holding
import uuid


def get_holdings(db: Session, user_id: str) -> list[Holding]:
    """All holdings of a user."""
    return db.query(Holding).filter(Holding.user_id == user_id).all()


def get_holding_by_id(db: Session, holding_id: str, user_id: str):
    """One holding, only if it belongs to the user (else None)."""
    return (
        db.query(Holding)
        .filter(Holding.id == holding_id, Holding.user_id == user_id)
        .first()
    )


def create_holding(db: Session, user_id: str, ticker: str, quantity: float,
                   cost_basis: float = None, account_type: str = "taxable") -> Holding:
    """Saves a new holding (ticker upper-cased) and returns it."""
    holding = Holding(
        user_id=user_id,
        ticker=ticker.upper(),
        quantity=quantity,
        cost_basis=cost_basis,
        account_type=account_type
    )
    db.add(holding)
    db.commit()
    db.refresh(holding)
    return holding


def delete_holding(db: Session, holding_id: str, user_id: str) -> bool:
    """Deletes a user's holding; False if it doesn't exist or isn't theirs."""
    holding = get_holding_by_id(db, holding_id, user_id)
    if not holding:
        return False
    db.delete(holding)
    db.commit()
    return True
from sqlalchemy.orm import Session
from app.models.models import Holding
import uuid


def get_holdings(db: Session, user_id: str) -> list[Holding]:
    return db.query(Holding).filter(Holding.user_id == user_id).all()


def get_holding_by_id(db: Session, holding_id: str, user_id: str):
    return (
        db.query(Holding)
        .filter(Holding.id == holding_id, Holding.user_id == user_id)
        .first()
    )


def create_holding(db: Session, user_id: str, ticker: str, quantity: float,
                   cost_basis: float = None, account_type: str = "taxable") -> Holding:
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
    holding = get_holding_by_id(db, holding_id, user_id)
    if not holding:
        return False
    db.delete(holding)
    db.commit()
    return True
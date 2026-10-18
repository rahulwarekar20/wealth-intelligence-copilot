"""Creates the demo user (test@example.com) with five sample holdings. Run: python -m app.seed"""

from app.core.db import SessionLocal
from app.models.models import User, Holding
from app.core.security import hash_password


def seed():
    """Creates the demo user and its sample holdings if they don't exist yet (safe to run repeatedly)."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "test@example.com").first()
        if not user:
            user = User(
                email="test@example.com",
                hashed_password=hash_password("testpass123"),
                risk_tolerance="moderate"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created user: {user.email}")
        else:
            print(f"User already exists: {user.email}")

        existing = db.query(Holding).filter(Holding.user_id == user.id).count()
        if existing == 0:
            holdings = [
                Holding(user_id=user.id, ticker="AAPL", quantity=10, cost_basis=150.00, account_type="taxable"),
                Holding(user_id=user.id, ticker="GOOGL", quantity=5, cost_basis=120.00, account_type="taxable"),
                Holding(user_id=user.id, ticker="SPY", quantity=20, cost_basis=400.00, account_type="taxable"),
                Holding(user_id=user.id, ticker="JPM", quantity=15, cost_basis=140.00, account_type="taxable"),
                Holding(user_id=user.id, ticker="MSFT", quantity=8, cost_basis=280.00, account_type="taxable"),
            ]
            db.add_all(holdings)
            db.commit()
            print(f"Added {len(holdings)} holdings")
        else:
            print(f"Holdings already exist: {existing} found")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
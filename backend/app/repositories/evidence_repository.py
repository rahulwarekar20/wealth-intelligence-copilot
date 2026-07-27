from sqlalchemy.orm import Session
from app.models.models import EvidenceItem
from datetime import datetime, timezone


def save_evidence_item(
    db: Session,
    ticker: str,
    source_type: str,
    payload: dict,
    reliability_weight: float = 1.0
) -> EvidenceItem:
    item = EvidenceItem(
        ticker=ticker.upper(),
        source_type=source_type,
        payload=payload,
        reliability_weight=reliability_weight,
        retrieved_at=datetime.now(timezone.utc)
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_evidence_by_ticker(
    db: Session,
    ticker: str,
    limit: int = 10
) -> list[EvidenceItem]:
    return (
        db.query(EvidenceItem)
        .filter(EvidenceItem.ticker == ticker.upper())
        .order_by(EvidenceItem.retrieved_at.desc())
        .limit(limit)
        .all()
    )


def get_latest_evidence(
    db: Session,
    ticker: str,
    source_type: str
) -> EvidenceItem:
    return (
        db.query(EvidenceItem)
        .filter(
            EvidenceItem.ticker == ticker.upper(),
            EvidenceItem.source_type == source_type
        )
        .order_by(EvidenceItem.retrieved_at.desc())
        .first()
    )
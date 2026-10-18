"""Stores and reads cached evidence per ticker and source, keeping only the newest items."""

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.models import EvidenceItem
from datetime import datetime, timezone
import logging

logger = logging.getLogger("wealth-copilot.evidence")

# Only the most recent snapshots per ticker/source are kept
MAX_ITEMS_PER_SOURCE = 20


def _prune_old_items(db: Session, ticker: str, source_type: str) -> None:
    """Deletes all but the newest MAX_ITEMS_PER_SOURCE items for a ticker and source."""
    stale_ids = [
        row.id for row in (
            db.query(EvidenceItem.id)
            .filter(EvidenceItem.ticker == ticker, EvidenceItem.source_type == source_type)
            .order_by(EvidenceItem.retrieved_at.desc())
            .offset(MAX_ITEMS_PER_SOURCE)
            .all()
        )
    ]
    if stale_ids:
        db.query(EvidenceItem).filter(EvidenceItem.id.in_(stale_ids)).delete(synchronize_session=False)


def save_evidence_item(
    db: Session,
    ticker: str,
    source_type: str,
    payload: dict,
    reliability_weight: float = 1.0
) -> EvidenceItem:
    """Stores a new evidence item and prunes old ones. Never raises: returns the existing item on a duplicate, None on other DB errors."""
    try:
        item = EvidenceItem(
            ticker=ticker.upper(),
            source_type=source_type,
            payload=payload,
            reliability_weight=reliability_weight,
            retrieved_at=datetime.now(timezone.utc)
        )
        db.add(item)
        db.flush()
        _prune_old_items(db, ticker.upper(), source_type)
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        # Return the existing item instead of crashing
        return get_latest_evidence(db, ticker, source_type)
    except Exception as e:
        db.rollback()
        logger.warning("Failed to save evidence %s/%s: %s", ticker, source_type, e)
        return None


def get_evidence_by_ticker(
    db: Session,
    ticker: str,
    limit: int = 10
) -> list[EvidenceItem]:
    """The newest evidence items for a ticker, across all sources."""
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
    """The newest evidence item for a ticker from one source, or None."""
    return (
        db.query(EvidenceItem)
        .filter(
            EvidenceItem.ticker == ticker.upper(),
            EvidenceItem.source_type == source_type
        )
        .order_by(EvidenceItem.retrieved_at.desc())
        .first()
    )
"""
Alert endpoints: list alerts (running the checks first when they are due)
and mark them as read.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user_id
from app.services import alert_service

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def get_alerts(refresh: bool = True, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """
    The user's newest alerts and unread count. With refresh=true (the default),
    the market checks run first if they haven't run in the last 30 minutes.
    """
    if refresh:
        alert_service.check_alerts(db, user_id)
    return alert_service.list_alerts(db, user_id)


@router.post("/read")
def mark_all_read(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """Marks every alert as read."""
    alert_service.mark_read(db, user_id)
    return {"message": "All alerts marked as read"}


@router.post("/{alert_id}/read")
def mark_one_read(alert_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """Marks one alert as read (ignored if it isn't the user's)."""
    try:
        uuid.UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert_service.mark_read(db, user_id, alert_id)
    return {"message": "Alert marked as read"}

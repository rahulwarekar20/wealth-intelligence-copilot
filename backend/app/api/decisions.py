from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.db import get_db
from app.core.security import get_current_user_id
from app.agents.graph import run_decision
from app.models.models import Decision

router = APIRouter(prefix="/decisions", tags=["decisions"])


class DecisionQuery(BaseModel):
    query: str
    ticker: str


class DecisionOut(BaseModel):
    decision_id: str
    ticker: str
    action: str
    confidence: float
    confidence_label: str
    summary: str
    evidence_for: list
    evidence_against: list
    portfolio_impact: str
    disagreement_flag: bool
    disagreement_note: str | None
    attribution: dict
    evidence_diversity_score: float
    disclosure: str


@router.post("/query")
def submit_query(
    payload: DecisionQuery,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Core endpoint -- runs the 5-agent LangGraph system
    and returns a structured investment recommendation.
    """
    if not payload.ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")

    if not payload.query:
        raise HTTPException(status_code=400, detail="Query is required")

    # Run the multi-agent graph
    recommendation = run_decision(
        query=payload.query,
        ticker=payload.ticker.upper(),
        user_id=user_id,
        db=db
    )

    # Save to decision journal
    decision = Decision(
        user_id=user_id,
        ticker=payload.ticker.upper(),
        query_text=payload.query,
        recommendation_json=recommendation,
        confidence=recommendation.get("confidence", 0),
        evidence_diversity_score=recommendation.get("evidence_diversity_score", 0),
        prompt_version=recommendation.get("prompt_version", "v1")
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)

    return {
        "decision_id": str(decision.id),
        **recommendation
    }


@router.get("/journal")
def get_journal(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Returns the user's decision journal --
    all past recommendations with timestamps.
    """
    decisions = (
        db.query(Decision)
        .filter(Decision.user_id == user_id)
        .order_by(Decision.created_at.desc())
        .limit(20)
        .all()
    )

    return [
        {
            "decision_id": str(d.id),
            "ticker": d.ticker,
            "query": d.query_text,
            "recommendation": d.recommendation_json,
            "confidence": float(d.confidence) if d.confidence else 0,
            "evidence_diversity_score": float(d.evidence_diversity_score) if d.evidence_diversity_score else 0,
            "created_at": str(d.created_at)
        }
        for d in decisions
    ]
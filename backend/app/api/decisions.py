"""
Copilot endpoints: /ask (natural-language question, routed by the supervisor),
/query (explicit ticker), /portfolio-strategy, /retirement, /journal (audit
trail of past recommendations) and /track-record (how past calls played out).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.core.db import get_db
from app.core.security import get_current_user_id
from app.models.models import Decision
from app.services.ask_service import answer_question
from app.services.strategy_service import get_or_run_strategy
from app.services.history_service import track_record

router = APIRouter(prefix="/decisions", tags=["decisions"])


class HistoryMessage(BaseModel):
    """One earlier chat turn sent for context."""
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


class AskQuery(BaseModel):
    """A natural-language question plus up to 20 earlier turns."""
    query: str = Field(min_length=1, max_length=2000)
    conversation_history: list[HistoryMessage] = Field(default=[], max_length=20)


class DecisionQuery(AskQuery):
    """A question about one explicitly named ticker."""
    ticker: str = Field(min_length=1, max_length=10)


class RetirementQuery(AskQuery):
    """A retirement question (same shape as AskQuery)."""
    pass


def _history(messages: list[HistoryMessage]) -> list[dict]:
    """Converts validated history messages to plain dicts for the agents."""
    return [m.model_dump() for m in messages]


def _respond(result: dict) -> dict:
    """Returns the agent result, or a 502 if the AI failed (never a fake answer)."""
    # Never present (or journal) a fake answer when the AI failed
    if result.get("error"):
        raise HTTPException(status_code=502, detail=result["error"])
    return result


@router.post("/ask")
def ask(
    payload: AskQuery,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Copilot chat endpoint. Works out whether the question is about a stock
    (and which one), the whole portfolio, or retirement, and answers it.
    Response "route" is one of: recommendation, comparison, strategy, retirement, clarify.
    """
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query is required")
    return _respond(answer_question(
        query=payload.query,
        history=_history(payload.conversation_history),
        user_id=user_id,
        db=db,
    ))


@router.post("/query")
def submit_query(
    payload: DecisionQuery,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Same as /ask, but the ticker is supplied explicitly instead of detected."""
    ticker = payload.ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query is required")
    return _respond(answer_question(
        query=payload.query,
        history=_history(payload.conversation_history),
        user_id=user_id,
        db=db,
        ticker=ticker,
    ))


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
            # Agent agreement (0–1); None when it couldn't be assessed (fewer than 2 signals)
            "evidence_diversity_score": float(d.evidence_diversity_score) if d.evidence_diversity_score is not None else None,
            "created_at": str(d.created_at)
        }
        for d in decisions
    ]


@router.get("/portfolio-strategy")
def portfolio_strategy(
    refresh: bool = False,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    A buy/sell/hold strategy for every holding plus an overall portfolio
    health assessment. Returns the saved strategy from the last 30 minutes
    ("reused": true) when holdings, profile and other assets are unchanged;
    ?refresh=true always runs a new analysis.
    """
    from app.agents.portfolio_strategy_agent import run_portfolio_strategy

    result = get_or_run_strategy(db, user_id, runner=run_portfolio_strategy, refresh=refresh)
    if result.get("no_holdings"):
        return result
    return _respond(result)


@router.post("/retirement")
def retirement_analysis(
    payload: RetirementQuery,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Retirement Intelligence Agent endpoint.
    Answers retirement questions using the user's actual portfolio.
    """
    from app.agents.retirement_agent import run_retirement_analysis
    return _respond(run_retirement_analysis(
        query=payload.query,
        user_id=user_id,
        db=db,
        history=_history(payload.conversation_history)
    ))


@router.get("/track-record")
def get_track_record(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Every distinct Buy/Hold/Sell call from the last 180 days with the price
    then and now, and a verdict: on_track, against, flat, too_early or n/a.
    """
    return {"calls": track_record(db, user_id)}

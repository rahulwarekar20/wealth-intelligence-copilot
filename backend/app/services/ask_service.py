"""
Single entry point for the copilot chat: works out what the user is asking
(stock, several stocks, whole portfolio, retirement) and which ticker(s) they
mean, verifies those tickers, then dispatches to the right agent(s).

Every result carries a "route":
  recommendation | comparison | strategy | retirement | clarify
Results containing "error" mean the AI failed and should be reported as such.
"""
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from sqlalchemy.orm import Session, sessionmaker

from app.agents.supervisor_agent import classify_intent
from app.agents.graph import run_decision
from app.agents.recommendation_composer import compose_comparison
from app.agents.retirement_agent import run_retirement_analysis
from app.agents.portfolio_strategy_agent import run_portfolio_strategy
from app.models.models import Decision
from app.repositories.portfolio_repository import get_holdings
from app.services.portfolio_service import fetch_current_price
from app.services.strategy_service import get_or_run_strategy, save_strategy  # noqa: F401 -- save_strategy re-exported

logger = logging.getLogger("wealth-copilot.ask")

_DOLLAR_TICKER = re.compile(r"\$([A-Za-z][A-Za-z0-9.\-]{0,9})\b")
_UPPER_WORD = re.compile(r"\b([A-Z][A-Z0-9.\-]{0,9})\b")

CLARIFY_WHICH_STOCK = (
    "Which stock do you mean? Name the company or its ticker (e.g. \"Should I buy more Apple?\" or \"AAPL\"), "
    "or ask about your whole portfolio or your retirement plans."
)
CLARIFY_GENERAL = (
    "I can analyse a specific stock, your whole portfolio, or your retirement plans. "
    "Which stock or topic would you like me to look at?"
)


# All-caps words people commonly type that are not meant as tickers
_NOT_TICKERS = {
    "I", "A", "AI", "ALL", "AND", "OR", "THE", "US", "USA", "UK", "EU", "OK", "ETF", "ETFS",
    "IRA", "ROTH", "CEO", "CFO", "IPO", "EPS", "PE", "YOY", "GDP", "FED", "USD", "EUR", "FIRE",
    "NOW", "IT", "ON", "SO", "BUY", "SELL", "HOLD", "TRIM",
}


def _typed_symbols(query: str) -> list[str]:
    """All-caps words that look like the user typed a ticker on purpose (e.g. 'XQZW')."""
    words = [w for w in _UPPER_WORD.findall(query) if 2 <= len(w) <= 6 and w not in _NOT_TICKERS]
    return list(dict.fromkeys(words))


def _explicit_tickers(query: str, held: set[str]) -> list[str]:
    """Tickers the user wrote unambiguously: $TSLA anywhere, or an uppercase word they hold."""
    found = [m.upper() for m in _DOLLAR_TICKER.findall(query)]
    found += [w for w in _UPPER_WORD.findall(query) if w in held]
    return list(dict.fromkeys(found))


def _is_real_ticker(ticker: str, held: set[str]) -> bool:
    """Held tickers are trusted; anything else must have a live market price."""
    # Held tickers are trusted; anything else must have a live market price
    return ticker in held or fetch_current_price(ticker) is not None


def _save_recommendation(db: Session, user_id: str, ticker: str, query: str, rec: dict) -> str:
    """Journals a single-stock recommendation and returns the new decision id."""
    decision = Decision(
        user_id=user_id,
        ticker=ticker,
        query_text=query,
        recommendation_json=rec,
        confidence=rec.get("confidence", 0),
        evidence_diversity_score=rec.get("evidence_diversity_score", 0),
        prompt_version=rec.get("prompt_version", "v1")
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return str(decision.id)


def _recommendation_ok(rec: dict) -> bool:
    """True if the agents produced a usable recommendation (an action and no error)."""
    return bool(rec) and not rec.get("error") and bool(rec.get("action"))


def _analyse_tickers(query: str, tickers: list[str], intent: str, agents: list, user_id: str, db: Session) -> list[dict]:
    """Runs the stock pipeline for each ticker. Several tickers run in parallel,
    each with its own DB session (SQLAlchemy sessions are not thread-safe)."""
    if len(tickers) == 1:
        return [run_decision(query, tickers[0], user_id, db, intent=intent, agents_needed=agents)]

    WorkerSession = sessionmaker(bind=db.get_bind(), autocommit=False, autoflush=False)
    # Comparisons need like-for-like data on every stock, so all agents run
    all_agents = ["portfolio_agent", "evidence_agent", "market_data_agent"]

    def run_one(ticker: str) -> dict:
        """Analyses one stock of a comparison on its own DB session (runs in a thread)."""
        worker_db = WorkerSession()
        # Each card describes its own stock; the head-to-head verdict is composed afterwards
        focused = (f"{query}\n(This is one part of a comparison of {', '.join(tickers)}. "
                   f"Describe {ticker} only; do not compare it with the others.)")
        try:
            return run_decision(focused, ticker, user_id, worker_db, intent=intent, agents_needed=all_agents)
        except Exception as e:
            logger.exception("Analysis failed for %s", ticker)
            return {"error": str(e)}
        finally:
            worker_db.close()

    with ThreadPoolExecutor(max_workers=len(tickers)) as executor:
        return list(executor.map(run_one, tickers))


def answer_question(
    query: str,
    history: list,
    user_id: str,
    db: Session,
    ticker: Optional[str] = None,
) -> dict:
    """
    Entry point for POST /decisions/ask: classifies the question and routes it.

    Returns a dict whose "route" says what kind of answer it is: "strategy",
    "retirement", "recommendation", "comparison", or "clarify" (a question back
    to the user). Returns {"error": ...} when the AI failed.
    """
    held = {h.ticker for h in get_holdings(db, user_id)}
    explicit = [ticker.upper()] if ticker else _explicit_tickers(query, held)

    classification = classify_intent(query, ticker=ticker, history=history, held_tickers=sorted(held))
    intent = classification["intent"]

    if classification["llm_error"] and not explicit:
        return {"error": f"Could not understand the question: {classification['llm_error']}"}

    # ── Whole portfolio ─────────────────────────────────────────────────────
    if intent == "portfolio_wide" and not ticker:
        # Reuses a recent strategy when nothing has changed (see strategy_service)
        result = get_or_run_strategy(db, user_id, runner=run_portfolio_strategy)
        if result.get("no_holdings"):
            return {"route": "clarify", "message": "You don't have any holdings yet. Add some on the Dashboard first."}
        if result.get("error"):
            return {"error": result["error"]}
        return {"route": "strategy", **result}

    # ── Retirement ──────────────────────────────────────────────────────────
    if intent == "retirement":
        result = run_retirement_analysis(query=query, user_id=user_id, db=db, history=history)
        if result.get("error"):
            return {"error": result["error"]}
        return {"route": "retirement", **result}

    # ── Specific stock(s) ───────────────────────────────────────────────────
    candidates = list(dict.fromkeys(classification["tickers"] + explicit))[:3]
    if ticker:
        candidates = [ticker.upper()]

    if not candidates and intent in ("single_position", "unclear"):
        # The model found no ticker, but the user may have typed one in capitals
        candidates = _typed_symbols(query)[:3]

    if not candidates:
        return {"route": "clarify", "message": CLARIFY_GENERAL if intent == "general_research" else CLARIFY_WHICH_STOCK}

    tickers = [t for t in candidates if _is_real_ticker(t, held)]
    unknown = [t for t in candidates if t not in tickers]
    if not tickers:
        names = ", ".join(unknown)
        return {
            "route": "clarify",
            "message": f"I couldn't find market data for {names}. Could you check the company name or ticker symbol?",
        }

    stock_intent = intent if intent in ("single_position", "general_research") else "single_position"
    results = _analyse_tickers(query, tickers, stock_intent, classification["agents_needed"], user_id, db)

    analysed = []
    for t, rec in zip(tickers, results):
        if _recommendation_ok(rec):
            decision_id = _save_recommendation(db, user_id, t, query, rec)
            analysed.append({"ticker": t, "decision_id": decision_id, **rec})

    if not analysed:
        first_error = next((r.get("error") for r in results if r.get("error")), None)
        return {"error": first_error or "The AI could not produce a recommendation. Please try again."}

    note = f"No market data found for {', '.join(unknown)}." if unknown else None
    failed = [t for t, rec in zip(tickers, results) if not _recommendation_ok(rec)]
    if failed:
        extra = f"Analysis failed for {', '.join(failed)}."
        note = f"{note} {extra}" if note else extra

    if len(analysed) == 1:
        return {"route": "recommendation", **analysed[0], "note": note}
    comparison = compose_comparison(query, analysed) or {}
    return {
        "route": "comparison",
        "results": analysed,
        "verdict": comparison.get("verdict"),
        "preferred": comparison.get("preferred"),
        "note": note,
    }

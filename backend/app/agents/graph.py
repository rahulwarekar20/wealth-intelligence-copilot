"""
LangGraph pipeline for a single-stock decision:

    specialists (Portfolio, Evidence, Market Data agents, run in parallel)
        -> composer (merges their views into one recommendation)

run_decision() is the entry point used by the ask service.
"""

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END
from sqlalchemy.orm import Session, sessionmaker

from app.agents.portfolio_agent import analyze_portfolio_impact
from app.agents.evidence_agent import analyze_evidence
from app.agents.market_data_agent import analyze_market_context
from app.agents.recommendation_composer import compose_recommendation

logger = logging.getLogger("wealth-copilot.graph")


class DecisionState(TypedDict):
    """State passed between LangGraph nodes: the question, routing info, and each agent's result."""
    query: str
    ticker: str
    user_id: str
    db: object
    intent: str
    agents_needed: list
    portfolio_result: Optional[dict]
    evidence_result: Optional[dict]
    market_result: Optional[dict]
    recommendation: Optional[dict]


ALL_AGENTS = ["portfolio_agent", "evidence_agent", "market_data_agent"]


def specialists_node(state: DecisionState) -> dict:
    """
    Runs the specialist agents the supervisor asked for IN PARALLEL -- they are
    independent, so this saves several seconds per question. Each agent that
    touches the database gets its own session (SQLAlchemy sessions aren't thread-safe).
    """
    needed = [a for a in ALL_AGENTS if a in (state.get("agents_needed") or ALL_AGENTS)]
    db = state["db"]
    make_session = sessionmaker(bind=db.get_bind(), autocommit=False, autoflush=False) if db is not None else None
    ticker, query, user_id, intent = state["ticker"], state["query"], state["user_id"], state["intent"]

    def run(agent: str):
        """Runs one specialist agent on its own DB session; returns (state key, result)."""
        started = time.time()
        worker_db = make_session() if make_session else None
        try:
            if agent == "portfolio_agent":
                return "portfolio_result", analyze_portfolio_impact(ticker=ticker, action=intent, db=worker_db, user_id=user_id)
            if agent == "evidence_agent":
                return "evidence_result", analyze_evidence(ticker=ticker, query=query, db=worker_db, user_id=user_id)
            return "market_result", analyze_market_context(ticker=ticker)
        except Exception as e:
            logger.exception("%s failed for %s", agent, ticker)
            return {"portfolio_agent": "portfolio_result", "evidence_agent": "evidence_result",
                    "market_data_agent": "market_result"}[agent], {"error": str(e)}
        finally:
            if worker_db is not None:
                worker_db.close()
            logger.info("[%s] %s finished in %.1fs", ticker, agent, time.time() - started)

    with ThreadPoolExecutor(max_workers=len(needed)) as executor:
        return dict(executor.map(run, needed))


def composer_node(state: DecisionState) -> dict:
    """Graph node: merges the specialist agents' results into the final recommendation."""
    logger.info("[Composer] Composing recommendation for %s", state["ticker"])
    result = compose_recommendation(
        query=state["query"],
        ticker=state["ticker"],
        intent=state["intent"],
        portfolio_result=state.get("portfolio_result") or {},
        evidence_result=state.get("evidence_result") or {},
        market_result=state.get("market_result") or {}
    )
    return {"recommendation": result}


def build_graph():
    """
    LangGraph decision graph for a single, already-resolved ticker:
    specialists (portfolio / evidence / market data, in parallel) -> composer
    """
    graph = StateGraph(DecisionState)
    graph.add_node("specialists", specialists_node)
    graph.add_node("composer", composer_node)
    graph.set_entry_point("specialists")
    graph.add_edge("specialists", "composer")
    graph.add_edge("composer", END)
    return graph.compile()


decision_graph = build_graph()


def run_decision(
    query: str,
    ticker: str,
    user_id: str,
    db: Session,
    intent: str = "single_position",
    agents_needed: list = None,
) -> dict:
    """Runs the specialist agents for one ticker and returns the composed recommendation."""
    initial_state = DecisionState(
        query=query,
        ticker=ticker,
        user_id=user_id,
        db=db,
        intent=intent,
        agents_needed=agents_needed or list(ALL_AGENTS),
        portfolio_result=None,
        evidence_result=None,
        market_result=None,
        recommendation=None
    )
    final_state = decision_graph.invoke(initial_state)
    return final_state.get("recommendation") or {}

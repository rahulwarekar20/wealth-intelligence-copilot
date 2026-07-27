from typing import TypedDict, Optional, Annotated
from langgraph.graph import StateGraph, END
from sqlalchemy.orm import Session
import operator

from app.agents.supervisor_agent import classify_intent
from app.agents.portfolio_agent import analyze_portfolio_impact
from app.agents.evidence_agent import analyze_evidence
from app.agents.market_data_agent import analyze_market_context
from app.agents.recommendation_composer import compose_recommendation


class DecisionState(TypedDict):
    """
    Shared state object passed between all agents in the graph.
    """
    query: str
    ticker: str
    user_id: str
    db: object

    # Supervisor output
    intent: Optional[str]
    agents_needed: Optional[list]

    # Specialist agent outputs
    portfolio_result: Optional[dict]
    evidence_result: Optional[dict]
    market_result: Optional[dict]

    # Final output
    recommendation: Optional[dict]


def supervisor_node(state: DecisionState) -> dict:
    print(f"[Supervisor] Classifying query: {state['query']}")
    result = classify_intent(state["query"], state["ticker"])
    return {
        "intent": result.get("intent", "single_position"),
        "agents_needed": result.get("agents_needed", [
            "portfolio_agent",
            "evidence_agent",
            "market_data_agent"
        ]),
        "ticker": result.get("ticker") or state["ticker"]
    }


def portfolio_node(state: DecisionState) -> dict:
    print(f"[Portfolio Agent] Analyzing portfolio impact for {state['ticker']}")
    result = analyze_portfolio_impact(
        ticker=state["ticker"],
        action=state.get("intent", "single_position"),
        db=state["db"],
        user_id=state["user_id"]
    )
    return {"portfolio_result": result}


def evidence_node(state: DecisionState) -> dict:
    print(f"[Evidence Agent] Gathering evidence for {state['ticker']}")
    result = analyze_evidence(
        ticker=state["ticker"],
        query=state["query"],
        db=state["db"]
    )
    return {"evidence_result": result}


def market_data_node(state: DecisionState) -> dict:
    print(f"[Market Data Agent] Analyzing market context for {state['ticker']}")
    result = analyze_market_context(ticker=state["ticker"])
    return {"market_result": result}


def composer_node(state: DecisionState) -> dict:
    print(f"[Composer] Composing recommendation for {state['ticker']}")
    result = compose_recommendation(
        query=state["query"],
        ticker=state["ticker"],
        intent=state.get("intent", "single_position"),
        portfolio_result=state.get("portfolio_result", {}),
        evidence_result=state.get("evidence_result", {}),
        market_result=state.get("market_result", {})
    )
    return {"recommendation": result}


def build_graph():
    """
    Builds the LangGraph decision graph.
    Runs agents sequentially to avoid state conflicts.

    Flow: supervisor -> portfolio -> evidence -> market_data -> composer
    """
    graph = StateGraph(DecisionState)

    graph.add_node("supervisor", supervisor_node)
    graph.add_node("portfolio", portfolio_node)
    graph.add_node("evidence", evidence_node)
    graph.add_node("market_data", market_data_node)
    graph.add_node("composer", composer_node)

    graph.set_entry_point("supervisor")

    # Sequential flow -- avoids state merge conflicts
    graph.add_edge("supervisor", "portfolio")
    graph.add_edge("portfolio", "evidence")
    graph.add_edge("evidence", "market_data")
    graph.add_edge("market_data", "composer")
    graph.add_edge("composer", END)

    return graph.compile()


decision_graph = build_graph()


def run_decision(query: str, ticker: str, user_id: str, db: Session) -> dict:
    """
    Main entry point for the multi-agent system.
    """
    initial_state = DecisionState(
        query=query,
        ticker=ticker,
        user_id=user_id,
        db=db,
        intent=None,
        agents_needed=None,
        portfolio_result=None,
        evidence_result=None,
        market_result=None,
        recommendation=None
    )

    final_state = decision_graph.invoke(initial_state)
    return final_state.get("recommendation", {})
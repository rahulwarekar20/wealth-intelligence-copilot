import re
from app.agents.llm_client import invoke_llm_json

VALID_INTENTS = {"single_position", "portfolio_wide", "retirement", "general_research", "unclear"}
VALID_AGENTS = ["portfolio_agent", "evidence_agent", "market_data_agent"]
MAX_TICKERS = 3

_TICKER_SHAPE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")


def classify_intent(
    query: str,
    ticker: str = None,
    history: list = None,
    held_tickers: list = None,
) -> dict:
    """
    Classifies the question, decides which specialist agents are needed and,
    unless `ticker` is given, works out which stock(s) the user means.

    Returns {"intent", "tickers", "agents_needed", "reasoning", "llm_error"}.
    Tickers are shape-checked here only; the caller verifies they really exist.
    llm_error is set when the model could not be reached or parsed.
    """
    history_text = ""
    if history:
        history_text = "\nPrevious conversation (oldest first):\n"
        for msg in history[-6:]:
            role = msg.get("role", "")
            content = (msg.get("content") or "")[:300]
            history_text += f"{role}: {content}\n"

    holdings_text = ", ".join(held_tickers) if held_tickers else "none"

    system_prompt = f"""You are the Supervisor Agent for a wealth intelligence platform.
Your job is to understand the user's question, decide how to answer it, and identify
which stock ticker(s) it is about.

Classify the intent as one of:
- single_position: about one or more specific stocks (buy/hold/sell/add/trim, outlook, comparison)
- portfolio_wide: about the user's overall portfolio (health, rebalance, diversification, concentration)
- retirement: about retirement planning, savings goals, pensions, 401k/IRA, financial independence,
  or a reply giving personal details (age, income, expenses) to an earlier retirement question
- general_research: market or sector questions that are not about a specific stock
- unclear: you cannot tell what the user wants, or which stock they mean

Ticker rules:
- Return exchange ticker symbols in uppercase, e.g. "Apple" -> "AAPL", "Google" -> "GOOGL".
- Prefer the user's own holdings when a company name matches one: {holdings_text}
- For follow-ups like "should I sell it?", use the stock from the previous conversation.
- Do NOT treat ordinary words (e.g. "all", "it", "on", "a", "now") as tickers.
- Return at most {MAX_TICKERS} tickers. Return [] for portfolio_wide, retirement or general_research.
- If the question is about a specific stock but you cannot tell which one, use intent "unclear".

Agents (only for single_position):
- portfolio_agent: holdings / portfolio impact
- evidence_agent: research, news, fundamentals
- market_data_agent: current price and trend

Respond in this exact JSON format:
{{
  "intent": "single_position",
  "tickers": ["AAPL"],
  "agents_needed": ["portfolio_agent", "evidence_agent", "market_data_agent"],
  "reasoning": "User is asking whether to buy more Apple"
}}"""

    ticker_line = f"Ticker chosen by the user: {ticker}\n" if ticker else ""
    user_prompt = f"""Question: {query}
{ticker_line}{history_text}
Respond with JSON only, no other text."""

    llm_error = None
    try:
        result = invoke_llm_json(system_prompt, user_prompt, max_tokens=400, use_small_model=True)
    except Exception as e:
        llm_error = str(e)
        result = {"reasoning": f"Fallback classification: {llm_error}"}

    # Validate the model's output so a bad classification can't break routing
    intent = result.get("intent")
    if intent not in VALID_INTENTS:
        intent = "single_position" if ticker else "unclear"

    if ticker:
        tickers = [ticker.upper()]
        if intent in ("unclear", "general_research"):
            intent = "single_position"
    else:
        tickers = []
        for t in result.get("tickers") or []:
            t = str(t).strip().upper().lstrip("$")
            if _TICKER_SHAPE.match(t) and t not in tickers:
                tickers.append(t)
        tickers = tickers[:MAX_TICKERS]

    agents = [a for a in (result.get("agents_needed") or []) if a in VALID_AGENTS]
    if not agents:
        agents = list(VALID_AGENTS)

    return {
        "intent": intent,
        "tickers": tickers,
        "agents_needed": agents,
        "reasoning": result.get("reasoning", ""),
        "llm_error": llm_error
    }

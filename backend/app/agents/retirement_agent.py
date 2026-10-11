import logging
from sqlalchemy.orm import Session
from app.agents.llm_client import invoke_llm_json
from app.repositories.portfolio_repository import get_holdings
from app.services.portfolio_service import value_holdings

logger = logging.getLogger("wealth-copilot.retirement")


def run_retirement_analysis(query: str, user_id: str, db: Session, history: list = None) -> dict:
    """
    Retirement Intelligence Agent.
    Analyses the user's actual portfolio in context of retirement questions.
    On LLM failure returns a dict containing "error".
    """
    logger.info("[Retirement Agent] Handling query")

    # Build conversation context so details the user already gave
    # (age, income, retirement age, expenses) are not asked for again
    history_text = ""
    if history:
        history_text = "\n\nConversation so far (oldest first):\n"
        for msg in history[-12:]:
            role = msg.get("role", "")
            content = (msg.get("content") or "")[:800]
            if content:
                history_text += f"{role}: {content}\n"

    # Fetch real portfolio data
    holdings = get_holdings(db, user_id)
    positions, total_value, unpriced = value_holdings(holdings)

    # Build portfolio context
    portfolio_text = f"Current Portfolio Value: ${total_value:,.2f}\n\nPositions:\n"
    for p in positions:
        if p["current_value"] is None:
            portfolio_text += f"- {p['ticker']}: {p['quantity']} shares (live price unavailable, not counted in total)\n"
            continue
        gain = f", {p['gain_loss_pct']:+.1f}% gain" if p["gain_loss_pct"] is not None else ""
        portfolio_text += f"- {p['ticker']}: ${p['current_value']:,.2f} ({p['weight_pct']:.1f}% of portfolio{gain})\n"
    if not positions:
        portfolio_text += "- No holdings recorded\n"

    system_prompt = """You are a Retirement Intelligence Agent for a wealth management platform.

You have access to the user's actual portfolio data and help them answer retirement planning questions.

Your job is to:
1. Answer the specific retirement question asked
2. Use their real portfolio data to give personalised, grounded advice
3. Ask clarifying questions if you need more information (age, target retirement age, monthly savings, expenses)
4. Be direct and specific — not generic

Common retirement rules of thumb you use:
- 4% withdrawal rule: retirement fund should be 25× annual expenses
- 10× salary rule: save 10× your annual salary by retirement age
- 15% savings rule: save at least 15% of income for retirement
- Portfolio allocation: subtract age from 110 for stock percentage (e.g. age 40 = 70% stocks)

If the user hasn't provided their age or retirement target, ask for it before giving a full analysis.

IMPORTANT — use the conversation history:
- Before asking for anything, check the conversation history. Any detail the user has already given
  (current age, annual income, target retirement age or years to retirement, annual retirement expenses,
  current savings rate) is KNOWN — never ask for it again.
- "Retire in N years" already tells you the time horizon; do not ask for retirement age as well.
- If the user's latest message is just answers to your earlier questions, combine them with their
  original question and give the full analysis now.
- If a minor detail is still missing, state a reasonable assumption (e.g. 7% nominal return, 3% inflation)
  and give the full numeric answer anyway, rather than asking again. Only set needs_more_info to true if
  you genuinely cannot produce any estimate.
- When you have enough information, show the actual numbers: target nest egg, projected value of the
  current portfolio, the gap, and the required monthly/annual savings.

Respond in this JSON format:
{
  "answer": "Direct answer to their question",
  "portfolio_assessment": "How their current portfolio relates to retirement",
  "action_items": ["specific action 1", "specific action 2"],
  "needs_more_info": false,
  "follow_up_question": "Question to ask if you need more info, or null",
  "confidence": "high|medium|low",
  "disclaimer": "This is informational only, not personalised financial advice."
}"""

    user_prompt = f"""User's latest message: {query}
{history_text}
Their actual portfolio:
{portfolio_text}

Answer their question using their real portfolio data and everything they have already told you in the conversation. Only ask for information that has not been provided anywhere above.

Respond with JSON only."""

    try:
        result = invoke_llm_json(system_prompt, user_prompt, max_tokens=1024, use_small_model=False, reasoning_effort="medium")
    except Exception as e:
        logger.warning("Retirement agent failed: %s", e)
        return {"error": f"Could not analyse your retirement question: {e}"}

    if not result.get("answer"):
        return {"error": "The AI returned an incomplete retirement analysis. Please try again."}
    if not isinstance(result.get("action_items"), list):
        result["action_items"] = []
    if result.get("confidence") not in ("high", "medium", "low"):
        result["confidence"] = "low"
    result["disclaimer"] = result.get("disclaimer") or "This is informational only, not personalised financial advice."
    result["total_portfolio_value"] = round(total_value, 2)
    result["positions"] = positions
    result["unpriced_tickers"] = unpriced
    return result
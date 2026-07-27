from app.agents.bedrock_client import invoke_claude


def classify_intent(query: str, ticker: str = None) -> dict:
    """
    Supervisor Agent -- classifies the user's question and decides
    which specialist agents to invoke.

    Returns:
        intent: single_position | portfolio_wide | general_research
        agents_needed: list of agents to invoke
        ticker: extracted ticker if not provided
    """
    system_prompt = """You are the Supervisor Agent for a wealth intelligence platform.
Your job is to classify investment questions and decide which specialist agents are needed.

Classify the intent as one of:
- single_position: question about a specific stock (buy/hold/sell/add)
- portfolio_wide: question about the overall portfolio (rebalance, diversification, concentration)
- general_research: general market or sector research question

Also identify which agents are needed:
- portfolio_agent: needed when user asks about their holdings or portfolio impact
- evidence_agent: needed when research or news about a specific ticker is relevant
- market_data_agent: needed when current price or trend data is relevant

Respond in this exact JSON format:
{
  "intent": "single_position",
  "agents_needed": ["portfolio_agent", "evidence_agent", "market_data_agent"],
  "ticker": "AAPL",
  "reasoning": "User is asking about a specific stock decision"
}"""

    user_prompt = f"""Classify this investment question:
Question: {query}
Ticker mentioned: {ticker or 'none'}

Respond with JSON only, no other text."""

    try:
        response = invoke_claude(system_prompt, user_prompt, max_tokens=256, use_haiku=True)
        import json
        # Clean response in case Claude adds markdown
        clean = response.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(clean)
        return result
    except Exception as e:
        # Safe fallback
        return {
            "intent": "single_position",
            "agents_needed": ["portfolio_agent", "evidence_agent", "market_data_agent"],
            "ticker": ticker or "",
            "reasoning": f"Fallback classification: {str(e)}"
        }

from app.agents.bedrock_client import invoke_claude
import json


def compute_diversity_score(
    portfolio_result: dict,
    evidence_result: dict,
    market_result: dict
) -> float:
    """
    Evidence Diversity Scorer -- deterministic logic that scores
    how much the three agents agree with each other.

    Returns a score between 0 and 1:
    - 1.0 = all agents agree strongly
    - 0.5 = mixed signals
    - 0.0 = agents strongly disagree
    """
    signals = []

    # Portfolio signal
    concentration = portfolio_result.get("concentration_flag", "LOW")
    if concentration == "LOW":
        signals.append(1.0)
    elif concentration == "MEDIUM":
        signals.append(0.5)
    else:
        signals.append(0.0)

    # Evidence signal
    tone = evidence_result.get("overall_evidence_tone", "neutral")
    if tone == "bullish":
        signals.append(1.0)
    elif tone == "mixed" or tone == "neutral":
        signals.append(0.5)
    else:
        signals.append(0.0)

    # Market signal
    market_signal = market_result.get("market_signal", "neutral")
    if market_signal == "bullish":
        signals.append(1.0)
    elif market_signal == "neutral":
        signals.append(0.5)
    else:
        signals.append(0.0)

    # Average the signals
    if signals:
        return round(sum(signals) / len(signals), 2)
    return 0.5


def compose_recommendation(
    query: str,
    ticker: str,
    intent: str,
    portfolio_result: dict,
    evidence_result: dict,
    market_result: dict
) -> dict:
    """
    Recommendation Composer -- the 5th agent.
    Synthesizes all specialist agent outputs into a final
    structured recommendation with attribution.
    """
    # Compute diversity score first (deterministic)
    diversity_score = compute_diversity_score(
        portfolio_result,
        evidence_result,
        market_result
    )

    composer_context = f"""
PORTFOLIO AGENT OUTPUT:
- Concentration Flag: {portfolio_result.get('concentration_flag', 'UNKNOWN')}
- Portfolio Impact: {portfolio_result.get('portfolio_impact', 'N/A')}
- Warning: {portfolio_result.get('warning', 'None')}
- Sector Overlap: {portfolio_result.get('sector_overlap', 'N/A')}
Portfolio Summary: {portfolio_result.get('portfolio_summary', {})}

EVIDENCE AGENT OUTPUT:
- Overall Tone: {evidence_result.get('overall_evidence_tone', 'neutral')}
- Evidence Quality: {evidence_result.get('evidence_quality', 'low')}
- Key Opportunity: {evidence_result.get('key_opportunity', 'None')}
- Key Risk: {evidence_result.get('key_risk', 'None')}
Evidence For: {json.dumps(evidence_result.get('evidence_for', []), indent=2)}
Evidence Against: {json.dumps(evidence_result.get('evidence_against', []), indent=2)}

MARKET DATA AGENT OUTPUT:
- Market Signal: {market_result.get('market_signal', 'neutral')}
- Momentum: {market_result.get('momentum', 'weak')}
- Current Price: ${market_result.get('current_price', 0):.2f}
- Daily Change: {market_result.get('daily_change_pct', 0):.2f}%
- Intraday Analysis: {market_result.get('intraday_analysis', 'N/A')}

EVIDENCE DIVERSITY SCORE: {diversity_score}
(1.0 = all agents agree, 0.0 = agents strongly disagree)
"""

    system_prompt = """You are the Recommendation Composer for a wealth intelligence platform.
You receive outputs from three specialist agents and synthesize them into
a final investment recommendation.

CRITICAL RULES:
1. If diversity_score is below 0.4, confidence MUST be low and you MUST flag disagreement
2. Never omit contradicting evidence to make the answer sound more decisive
3. Always show which agent contributed which insight (attribution)
4. The disclosure statement is mandatory on every response

Respond in this exact JSON format:
{
  "action": "buy|hold|sell|rebalance",
  "confidence": 0.75,
  "confidence_label": "high|medium|low",
  "summary": "2-3 sentence plain English summary of the recommendation",
  "evidence_for": [
    {"point": "supporting point", "agent": "evidence_agent|market_data_agent|portfolio_agent"}
  ],
  "evidence_against": [
    {"point": "contradicting point", "agent": "evidence_agent|market_data_agent|portfolio_agent"}
  ],
  "portfolio_impact": "description of impact on portfolio",
  "disagreement_flag": true,
  "disagreement_note": "description of what agents disagree on or null",
  "attribution": {
    "portfolio_agent": "what this agent contributed",
    "evidence_agent": "what this agent contributed",
    "market_data_agent": "what this agent contributed"
  },
  "disclosure": "This analysis is informational only and does not constitute personalized investment advice. Always consult a qualified financial advisor before making investment decisions."
}"""

    user_prompt = f"""Synthesize this investment recommendation:
Question: {query}
Ticker: {ticker}
Intent: {intent}

{composer_context}

Respond with JSON only, no other text."""

    try:
        response = invoke_claude(system_prompt, user_prompt, max_tokens=1500)
        clean = response.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(clean)
        result["evidence_diversity_score"] = diversity_score
        result["prompt_version"] = "v1"
        return result
    except Exception as e:
        return {
            "action": "hold",
            "confidence": 0.0,
            "confidence_label": "low",
            "summary": "Could not compose recommendation due to an error.",
            "evidence_for": [],
            "evidence_against": [],
            "portfolio_impact": "Unknown",
            "disagreement_flag": False,
            "disagreement_note": None,
            "attribution": {},
            "evidence_diversity_score": diversity_score,
            "disclosure": "This analysis is informational only.",
            "error": str(e)
        }
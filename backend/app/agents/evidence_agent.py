from sqlalchemy.orm import Session
from app.agents.bedrock_client import invoke_claude
from app.services.evidence_service import gather_evidence


def analyze_evidence(ticker: str, query: str, db: Session) -> dict:
    """
    Evidence Agent -- gathers and reasons over all available
    evidence for a ticker.

    Returns structured evidence analysis with supporting
    and contradicting signals.
    """
    # Gather all evidence from Finnhub
    evidence = gather_evidence(ticker, db)

    price_data = evidence.get("price_data", {})
    news = evidence.get("news_sentiment", {})
    fundamentals = evidence.get("fundamentals", {})

    evidence_context = f"""
Price Data:
- Current Price: ${price_data.get('current_price', 0):.2f}
- Daily Change: {price_data.get('daily_change_pct', 0):.2f}%
- Trend: {price_data.get('trend', 'unknown')}
- 52-Week High: {fundamentals.get('52_week_high', 'N/A')}
- 52-Week Low: {fundamentals.get('52_week_low', 'N/A')}

Company Fundamentals:
- Company: {fundamentals.get('company_name', ticker)}
- Industry: {fundamentals.get('industry', 'Unknown')}
- Market Cap: ${fundamentals.get('market_cap', 0):,.0f}M
- P/E Ratio: {fundamentals.get('pe_ratio', 'N/A')}
- Revenue Growth: {fundamentals.get('revenue_growth', 'N/A')}
- Profit Margin: {fundamentals.get('profit_margin', 'N/A')}

News Sentiment:
- Total Headlines: {news.get('headline_count', 0)}
- Overall Sentiment: {news.get('sentiment', 'neutral')}
- Sentiment Score: {news.get('sentiment_score', 0)}
- Recent Headlines:
"""
    for h in news.get("headlines", [])[:3]:
        evidence_context += f"  * {h.get('headline', '')}\n"

    system_prompt = """You are the Evidence Agent for a wealth intelligence platform.
Your job is to analyze all available evidence for a stock and identify
what SUPPORTS and what CONTRADICTS a positive investment view.

Be specific and cite the actual data provided.
Do NOT make up data that is not provided.
If evidence is insufficient, say so explicitly.

Respond in this exact JSON format:
{
  "evidence_for": [
    {"signal": "description of positive signal", "source": "price_volume|filing|sentiment", "strength": "strong|moderate|weak"}
  ],
  "evidence_against": [
    {"signal": "description of negative signal", "source": "price_volume|filing|sentiment", "strength": "strong|moderate|weak"}
  ],
  "overall_evidence_tone": "bullish|bearish|neutral|mixed",
  "key_risk": "main risk identified or null",
  "key_opportunity": "main opportunity identified or null",
  "evidence_quality": "high|medium|low"
}"""

    user_prompt = f"""Analyze this evidence for {ticker}:
Question context: {query}

{evidence_context}

Respond with JSON only, no other text."""

    try:
        response = invoke_claude(system_prompt, user_prompt, max_tokens=1024, use_haiku=True)
        import json
        clean = response.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(clean)
        result["raw_evidence"] = {
            "price": price_data,
            "fundamentals": fundamentals,
            "sentiment": news.get("sentiment"),
            "sentiment_score": news.get("sentiment_score"),
            "headline_count": news.get("headline_count")
        }
        return result
    except Exception as e:
        return {
            "evidence_for": [],
            "evidence_against": [],
            "overall_evidence_tone": "neutral",
            "key_risk": None,
            "key_opportunity": None,
            "evidence_quality": "low",
            "error": str(e)
        }
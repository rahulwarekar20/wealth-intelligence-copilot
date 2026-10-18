"""
Recommendation Composer: merges the specialist agents' outputs into one
recommendation (action, confidence, key points, evidence for/against).
Measures how much the agents agree and enforces the disagreement guardrail in
code. Also composes multi-stock comparisons.
"""

import json
from app.agents.llm_client import invoke_llm_json

DISCLOSURE = (
    "This analysis is informational only and does not constitute personalized investment advice. "
    "Always consult a qualified financial advisor before making investment decisions."
)
VALID_ACTIONS = {"buy", "hold", "sell", "rebalance"}


def compute_diversity_score(
    portfolio_result: dict,
    evidence_result: dict,
    market_result: dict
) -> float:
    """
    Evidence Diversity Scorer -- deterministic logic that scores
    how much the agents agree with each other.

    Agents that were skipped or failed (empty result / unknown signal)
    are left out instead of being counted as disagreement.

    Returns a score between 0 and 1:
    - 1.0 = all agents agree strongly
    - 0.5 = mixed signals
    - 0.0 = agents strongly disagree
    """
    signals = []

    # Portfolio signal
    concentration = (portfolio_result or {}).get("concentration_flag")
    if concentration == "LOW":
        signals.append(1.0)
    elif concentration == "MEDIUM":
        signals.append(0.5)
    elif concentration == "HIGH":
        signals.append(0.0)

    # Evidence signal
    tone = (evidence_result or {}).get("overall_evidence_tone")
    if (evidence_result or {}).get("error"):
        tone = None
    if tone == "bullish":
        signals.append(1.0)
    elif tone in ("mixed", "neutral"):
        signals.append(0.5)
    elif tone == "bearish":
        signals.append(0.0)

    # Market signal
    market_signal = (market_result or {}).get("market_signal")
    if market_signal == "bullish":
        signals.append(1.0)
    elif market_signal == "neutral":
        signals.append(0.5)
    elif market_signal == "bearish":
        signals.append(0.0)

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

    On LLM failure returns a dict containing "error" so the API can report
    the failure instead of presenting (and journaling) a fake recommendation.
    """
    diversity_score = compute_diversity_score(portfolio_result, evidence_result, market_result)

    composer_context = f"""
INVESTOR PROFILE: {portfolio_result.get('investor_profile', 'not available')}

PORTFOLIO AGENT OUTPUT:
- Concentration Flag: {portfolio_result.get('concentration_flag', 'NOT RUN')}
- Portfolio Impact: {portfolio_result.get('portfolio_impact', 'N/A')}
- Warning: {portfolio_result.get('warning', 'None')}
- Sector Overlap: {portfolio_result.get('sector_overlap', 'N/A')}
Portfolio Summary: {portfolio_result.get('portfolio_summary', {})}

EVIDENCE AGENT OUTPUT:
- Overall Tone: {evidence_result.get('overall_evidence_tone', 'NOT RUN')}
- Evidence Quality: {evidence_result.get('evidence_quality', 'N/A')}
- Key Opportunity: {evidence_result.get('key_opportunity', 'None')}
- Key Risk: {evidence_result.get('key_risk', 'None')}
Evidence For: {json.dumps(evidence_result.get('evidence_for', []), indent=2)}
Evidence Against: {json.dumps(evidence_result.get('evidence_against', []), indent=2)}

MARKET DATA AGENT OUTPUT:
- Market Signal: {market_result.get('market_signal', 'NOT RUN')}
- Momentum: {market_result.get('momentum', 'N/A')}
- Current Price: ${market_result.get('current_price') or 0:.2f}
- Daily Change: {market_result.get('daily_change_pct') or 0:.2f}%
- Intraday Analysis: {market_result.get('intraday_analysis', 'N/A')}

{_sec_fallback_text(evidence_result)}
EVIDENCE DIVERSITY SCORE: {diversity_score}
(1.0 = all agents agree, 0.0 = agents strongly disagree)
"""

    system_prompt = """You are the Recommendation Composer for a wealth intelligence platform.
You receive outputs from up to three specialist agents and synthesize them into
a final answer. Agents marked NOT RUN were not needed for this question.

FIRST answer the user's actual question directly (e.g. if they ask about risks, list the risks;
if they ask whether to buy, say so). THEN give the buy/hold/sell view.

WRITING STYLE -- the reader scans this on screen:
- Plain English, short sentences, no filler or hedging phrases.
- "answer": max 2 sentences, max 40 words.
- "key_points": 3-4 items that directly answer the question, each max 15 words.
- "summary": why this action, one sentence, max 25 words.
- "evidence_for" = POSITIVES for owning the stock (strengths, growth, momentum).
  "evidence_against" = NEGATIVES / RISKS of owning it. This holds even when the user asks about risks.
  Max 3 items each, each max 15 words.
- Lead each point with the fact or number (e.g. "Revenue up 15% to $281.7B in FY2026").

RULES:
1. If diversity_score is below 0.4, confidence MUST be low and you MUST flag disagreement
2. Never omit contradicting evidence to make the answer sound more decisive
3. Keep the Evidence Agent's citation on every point (e.g. "MSFT 10-K FY2026, Item 1A Risk Factors");
   use "market data", "news headlines" or "portfolio data" for points from the other agents
4. Prefer official SEC figures over other numbers and quote them exactly
5. Fit the action to the INVESTOR PROFILE: a conservative investor or a short horizon calls for
   more caution (prefer hold/trim over adding to volatile positions); never suggest taking a
   position above the investor's stated maximum position size

Respond in this exact JSON format:
{
  "answer": "Direct answer to the question",
  "key_points": [{"point": "short fact answering the question", "citation": "source"}],
  "action": "buy|hold|sell|rebalance",
  "confidence": 0.75,
  "summary": "Why this action",
  "evidence_for": [{"point": "short positive for owning the stock", "agent": "evidence_agent|market_data_agent|portfolio_agent", "citation": "source"}],
  "evidence_against": [{"point": "short negative / risk of owning the stock", "agent": "evidence_agent|market_data_agent|portfolio_agent", "citation": "source"}],
  "disagreement_flag": false,
  "disagreement_note": "what the agents disagree on, or null"
}"""

    user_prompt = f"""Synthesize this investment recommendation:
Question: {query}
Ticker: {ticker}
Intent: {intent}

{composer_context}

Respond with JSON only, no other text."""

    try:
        result = invoke_llm_json(system_prompt, user_prompt, max_tokens=900)
    except Exception as e:
        return {"error": f"Could not compose recommendation: {e}", "evidence_diversity_score": diversity_score}

    # Normalise the model output so the UI and journal always get valid fields
    action = str(result.get("action", "hold")).lower()
    result["action"] = action if action in VALID_ACTIONS else "hold"
    try:
        confidence = float(result.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = min(max(confidence, 0.0), 1.0)

    # Enforce the low-diversity guardrail in code, not just in the prompt
    if diversity_score < 0.4:
        confidence = min(confidence, 0.4)
        result["disagreement_flag"] = True
        result.setdefault("disagreement_note", "Specialist agents produced conflicting signals.")

    result["confidence"] = round(confidence, 2)
    result["confidence_label"] = "high" if confidence >= 0.7 else "medium" if confidence >= 0.4 else "low"
    result["summary"] = result.get("summary") or "No summary provided."
    result["answer"] = result.get("answer") or result["summary"]
    # Hard caps keep the card scannable even if the model ignores the length rules
    result["key_points"] = _points(result.get("key_points"), 4)
    result["evidence_for"] = _points(result.get("evidence_for"), 3)
    result["evidence_against"] = _points(result.get("evidence_against"), 3)
    result["disagreement_flag"] = bool(result.get("disagreement_flag", False))
    result["disclosure"] = DISCLOSURE
    result["sources"] = evidence_result.get("sources") or []
    result["metrics"] = build_metrics(ticker, portfolio_result, evidence_result, market_result)
    result["evidence_diversity_score"] = diversity_score
    result["prompt_version"] = "v2"
    return result


def _sec_fallback_text(evidence_result: dict) -> str:
    """If the Evidence Agent's LLM step failed, pass the official SEC figures through directly."""
    if not evidence_result.get("error"):
        return ""
    text = (evidence_result.get("raw_evidence") or {}).get("sec_financials_text")
    return f"\n{text}\n(The Evidence Agent's analysis failed; use these official figures directly.)\n" if text else ""


def compose_comparison(query: str, analyses: list[dict]) -> dict | None:
    """
    Head-to-head verdict across several per-ticker analyses, so a comparison
    question gets one consistent answer. Returns {"verdict", "preferred"} or None.
    """
    lines = []
    for a in analyses:
        m = a.get("metrics") or {}
        facts = ", ".join(
            f"{label} {m[key]}" for key, label in (
                ("revenue_growth_pct", "revenue growth %"), ("net_margin_pct", "net margin %"),
                ("pe_ratio", "P/E"), ("daily_change_pct", "today %"), ("portfolio_weight_pct", "portfolio weight %"),
            ) if m.get(key) is not None
        )
        lines.append(f"- {a['ticker']}: {a['action'].upper()} ({a['confidence']:.0%} confidence). {a.get('summary', '')} [{facts}]")

    system_prompt = """You compare stocks for a wealth intelligence platform.
Given one analysis per stock, answer the user's comparison question in at most 2 short sentences
(max 40 words), naming which stock looks stronger and the main reason, quoting a number.
If neither is clearly stronger, say so. Respond in JSON:
{"verdict": "short answer", "preferred": "TICKER or null"}"""
    user_prompt = f"Question: {query}\n\n" + "\n".join(lines) + "\n\nRespond with JSON only."

    try:
        result = invoke_llm_json(system_prompt, user_prompt, max_tokens=300, use_small_model=True)
    except Exception:
        return None
    tickers = {a["ticker"] for a in analyses}
    preferred = str(result.get("preferred") or "").upper()
    return {
        "verdict": result.get("verdict") or "",
        "preferred": preferred if preferred in tickers else None,
    }


def _points(items, limit: int) -> list[dict]:
    """Normalises LLM evidence points to {'point': ...} dicts, dropping empty ones, at most `limit`."""
    out = []
    for item in items or []:
        if isinstance(item, str):
            item = {"point": item}
        if isinstance(item, dict) and item.get("point"):
            out.append(item)
    return out[:limit]


def build_metrics(ticker: str, portfolio_result: dict, evidence_result: dict, market_result: dict) -> dict:
    """
    Key numbers for the card, taken straight from the data feeds (never from
    the LLM): price, daily move, portfolio weight and SEC 10-K figures.
    """
    raw = evidence_result.get("raw_evidence") or {}
    sec = raw.get("sec_highlights") or {}
    price_feed = raw.get("price") or {}
    weight = ((portfolio_result.get("portfolio_summary") or {}).get("concentration") or {}).get(ticker.upper())

    price = market_result.get("current_price") or price_feed.get("current_price")
    change = market_result.get("daily_change_pct")
    if change is None:
        change = price_feed.get("daily_change_pct")

    metrics = {
        "company": raw.get("company"),
        "price": price or None,
        "daily_change_pct": change if price else None,
        "portfolio_weight_pct": weight,
        "fiscal_year_end": sec.get("fiscal_year_end"),
        "revenue": sec.get("revenue"),
        "revenue_growth_pct": sec.get("revenue_growth_pct"),
        "net_margin_pct": sec.get("net_margin_pct"),
        "pe_ratio": (raw.get("fundamentals") or {}).get("pe_ratio"),
    }
    return {k: v for k, v in metrics.items() if v is not None}

"""
Recommendation Composer: merges the specialist agents' outputs into one
recommendation (action, confidence, key points, evidence for/against).
Signal direction, agreement and coverage, citation checks and the confidence
caps are applied in code via guardrails.py. Also composes multi-stock comparisons.
"""

import json
from typing import Optional

from app.agents.llm_client import invoke_llm_json
from app.agents.guardrails import (
    apply_confidence_policy, assess_signals, check_points, citation_catalog, describe_assessment,
)

DISCLOSURE = (
    "This analysis is informational only and does not constitute personalized investment advice. "
    "Always consult a qualified financial advisor before making investment decisions."
)
VALID_ACTIONS = {"buy", "hold", "sell", "rebalance"}


def compose_recommendation(
    query: str,
    ticker: str,
    intent: str,
    portfolio_result: dict,
    evidence_result: dict,
    market_result: dict,
    agents_needed: Optional[list] = None,
) -> dict:
    """
    Recommendation Composer -- the 5th agent.
    Synthesizes all specialist agent outputs into a final
    structured recommendation with attribution.

    On LLM failure returns a dict containing "error" so the API can report
    the failure instead of presenting (and journaling) a fake recommendation.

    Guardrails (see guardrails.py) are applied in code: direction, agreement and
    coverage are assessed separately; the evidence agent's signals are only
    passed on if their citations match retrieved sources; the final points are
    citation-checked per specialist; and confidence is capped on conflict,
    thin coverage or unverifiable citations.
    """
    assessment = assess_signals(portfolio_result, evidence_result, market_result, agents_needed)
    catalog = citation_catalog(ticker, portfolio_result, evidence_result, market_result)

    # The evidence agent's signals reach the composer only if their citations check out
    evidence_signals, withheld_items = {}, []
    for side in ("evidence_for", "evidence_against"):
        items = [dict(i) for i in (evidence_result or {}).get(side) or [] if isinstance(i, dict)]
        check_points(items, catalog, default_agent="evidence_agent")
        evidence_signals[side] = [i for i in items if i["citation_verified"]]
        withheld_items += [{"citation": i.get("citation"), "issue": i.get("citation_issue")}
                           for i in items if not i["citation_verified"]]
    withheld = len(withheld_items)

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
Evidence For: {json.dumps(evidence_signals['evidence_for'], indent=2)}
Evidence Against: {json.dumps(evidence_signals['evidence_against'], indent=2)}
(Withheld {withheld} evidence signal(s) whose citations did not match a retrieved source.)

MARKET DATA AGENT OUTPUT:
- Market Signal: {market_result.get('market_signal', 'NOT RUN')}
- Momentum: {market_result.get('momentum', 'N/A')}
- Current Price: ${market_result.get('current_price') or 0:.2f}
- Daily Change: {market_result.get('daily_change_pct') or 0:.2f}%
- Intraday Analysis: {market_result.get('intraday_analysis', 'N/A')}

{_sec_fallback_text(evidence_result)}
{describe_assessment(assessment)}
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
1. Use the SIGNAL ASSESSMENT. Agreement below 0.5 means the specialists point in opposite
   directions: confidence MUST be low and you MUST flag disagreement. Unanimous signals in either
   direction are agreement — a confident sell or trim is allowed when all signals are negative.
   If coverage is incomplete, say which evidence is missing.
2. Never omit contradicting evidence to make the answer sound more decisive
3. Keep the Evidence Agent's citation on every point exactly as given (e.g. "MSFT 10-K FY2026, Item 1A
   Risk Factors"); use "market data", "news headlines" or "portfolio data" for points from the other
   agents. Never cite a source that is not listed above — citations are checked in code
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
        return {"error": f"Could not compose recommendation: {e}", "evidence_diversity_score": assessment["agreement"]}

    # Normalise the model output so the UI and journal always get valid fields
    action = str(result.get("action", "hold")).lower()
    result["action"] = action if action in VALID_ACTIONS else "hold"
    try:
        confidence = float(result.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = min(max(confidence, 0.0), 1.0)

    result["summary"] = result.get("summary") or "No summary provided."
    result["answer"] = result.get("answer") or result["summary"]
    # Hard caps keep the card scannable even if the model ignores the length rules
    result["key_points"] = _points(result.get("key_points"), 4)
    result["evidence_for"] = _points(result.get("evidence_for"), 3)
    result["evidence_against"] = _points(result.get("evidence_against"), 3)

    # Check every final citation against what the specialists actually retrieved
    verified = cited = 0
    for side in ("key_points", "evidence_for", "evidence_against"):
        v, n = check_points(result[side], catalog)
        verified, cited = verified + v, cited + n

    # Confidence and disagreement are decided in code, not by the model
    policy = apply_confidence_policy(confidence, assessment, verified, cited)
    model_note = result.get("disagreement_note")
    result["confidence"] = policy["confidence"]
    result["confidence_label"] = ("high" if policy["confidence"] >= 0.7
                                  else "medium" if policy["confidence"] >= 0.4 else "low")
    result["disagreement_flag"] = policy["disagreement_flag"]
    result["disagreement_note"] = (model_note or policy["disagreement_note"]) if policy["disagreement_flag"] else None
    result["confidence_notes"] = policy["confidence_notes"]
    result["signal_assessment"] = assessment
    # Audit trail of the check, journaled with the answer
    result["citation_check"] = {"verified": verified, "cited": cited, "evidence_signals_withheld": withheld,
                                "withheld": withheld_items}
    result["disclosure"] = DISCLOSURE
    result["sources"] = evidence_result.get("sources") or []
    result["metrics"] = build_metrics(ticker, portfolio_result, evidence_result, market_result)
    # Journal column keeps its old name; it now stores agreement (None when not assessable)
    result["evidence_diversity_score"] = assessment["agreement"]
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

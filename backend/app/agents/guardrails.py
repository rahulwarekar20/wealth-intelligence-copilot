"""
Code-enforced guardrails for stock recommendations.

1. Signal assessment — the specialists' views are kept as three separate
   measures instead of one averaged score:
     direction  net lean of the signals, -1 (bearish) .. +1 (bullish); describes
                the view, never used to cap confidence
     agreement  do the signals point the same way? 1.0 = unanimous (bullish OR
                bearish), 0.0 = bullish vs bearish; None with fewer than 2 signals
     coverage   share of the specialists asked to run that returned a signal
   Unanimous bearish signals are agreement, not disagreement.

2. Citation verification — every point must cite a source its specialist
   actually had: a retrieved 10-K section, SEC financials, market data, news,
   portfolio data, or a matched user document. Points attributed to one agent
   but citing another agent's source are also flagged.

3. Confidence policy — conflict caps confidence at CONFLICT_CAP and flags
   disagreement; missing requested evidence or unverifiable citations cap it at
   LIMITED_EVIDENCE_CAP with a note saying why. A question that only needed one
   specialist is not capped, but is noted as not cross-checked.
"""
import re
from typing import Optional

SPECIALISTS = ("portfolio_agent", "evidence_agent", "market_data_agent")

CONFLICT_THRESHOLD = 0.5       # agreement below this = the specialists genuinely disagree
CONFLICT_CAP = 0.4             # max confidence when they disagree
LIMITED_EVIDENCE_CAP = 0.5     # max confidence with thin coverage or unverified citations
MIN_COVERAGE = 2 / 3           # share of requested specialists that must return a signal
MAX_UNVERIFIED_SHARE = 1 / 3   # above this share of unverified citations, confidence is capped

# Each specialist's view as a direction: +1 supports owning/adding, -1 argues against, 0 neutral.
# Portfolio: a small position leaves room to add; one above the limit argues for reducing.
_PORTFOLIO_DIRECTION = {"LOW": 1.0, "MEDIUM": 0.0, "HIGH": -1.0}
_TONE_DIRECTION = {"bullish": 1.0, "neutral": 0.0, "mixed": 0.0, "bearish": -1.0}

# Which kinds of source each specialist is allowed to cite
_AGENT_SOURCES = {
    "portfolio_agent": {"portfolio"},
    "market_data_agent": {"market"},
    "evidence_agent": {"sec_section", "sec_financials", "news", "market", "document"},
}


# ── 1. Signal assessment ─────────────────────────────────────────────────────

def _signal(agent: str, result: Optional[dict]) -> Optional[float]:
    """The specialist's direction, or None if it failed or gave no usable signal."""
    if not result or result.get("error"):
        return None
    if agent == "portfolio_agent":
        return _PORTFOLIO_DIRECTION.get(result.get("concentration_flag"))
    if agent == "evidence_agent":
        return _TONE_DIRECTION.get(result.get("overall_evidence_tone"))
    return _TONE_DIRECTION.get(result.get("market_signal"))


def assess_signals(portfolio_result: dict, evidence_result: dict, market_result: dict,
                   agents_needed: Optional[list] = None) -> dict:
    """
    Direction, agreement and coverage of the specialists' signals, plus which
    requested specialists returned nothing (failed or unusable).
    """
    requested = [a for a in SPECIALISTS if a in (agents_needed or SPECIALISTS)]
    results = {"portfolio_agent": portfolio_result, "evidence_agent": evidence_result,
               "market_data_agent": market_result}
    signals = {a: _signal(a, results[a]) for a in requested}
    available = [v for v in signals.values() if v is not None]

    direction = round(sum(available) / len(available), 2) if available else None
    agreement = round(1 - (max(available) - min(available)) / 2, 2) if len(available) >= 2 else None
    return {
        "signals": signals,
        "direction": direction,
        "direction_label": (None if direction is None else
                            "positive" if direction > 0.33 else "negative" if direction < -0.33 else "neutral"),
        "agreement": agreement,
        "coverage": round(len(available) / len(requested), 2) if requested else 0.0,
        "signals_available": len(available),
        "signals_requested": len(requested),
        "missing": [a for a, v in signals.items() if v is None],
    }


def describe_assessment(a: dict) -> str:
    """The assessment as prompt text, with each measure explained."""
    agreement = "not assessable (fewer than 2 signals)" if a["agreement"] is None else (
        f"{a['agreement']} (1.0 = all point the same way, bullish or bearish; 0.0 = bullish vs bearish)")
    direction = "none" if a["direction"] is None else f"{a['direction']} ({a['direction_label']}; -1 bearish .. +1 bullish)"
    missing = ", ".join(a["missing"]) or "none"
    return (f"SIGNAL ASSESSMENT (computed in code):\n"
            f"- Direction: {direction} — the net lean; NOT a confidence measure\n"
            f"- Agreement: {agreement}\n"
            f"- Coverage: {a['signals_available']} of {a['signals_requested']} requested specialists returned a signal "
            f"(missing: {missing})")


# ── 2. Citation verification ─────────────────────────────────────────────────

def _norm(text: str) -> str:
    """Lower-cased citation text without brackets and with single spaces, for matching."""
    return re.sub(r"\s+", " ", re.sub(r"[\[\]()]", "", str(text or "")).lower()).strip()


def _item_key(citation: str) -> Optional[tuple]:
    """(ticker or None, fiscal year or None, item number) for a 10-K section citation, else None."""
    m = re.search(r"(?:\b([a-z.\-]+) )?10-k(?: fy(\d{4}))?.*?\bitem (\d+[a-z]?)\b", _norm(citation))
    return (m.group(1), m.group(2), m.group(3)) if m else None


def citation_catalog(ticker: str, portfolio_result: dict, evidence_result: dict, market_result: dict) -> dict:
    """What each kind of source actually contained for this answer."""
    raw = (evidence_result or {}).get("raw_evidence") or {}
    evidence_ok = bool(evidence_result) and not evidence_result.get("error")
    return {
        "ticker": ticker.lower(),
        "sections": {k for k in (_item_key(c) for c in raw.get("passage_citations") or []) if k},
        "sec_financials": bool(raw.get("sec_financials_text")),
        "news": bool(raw.get("headline_count")),
        "market": (bool(market_result) and not market_result.get("error") and market_result.get("market_signal") != "unknown")
                  or bool((raw.get("price") or {}).get("current_price")),
        "portfolio": bool(portfolio_result) and not portfolio_result.get("error")
                     and portfolio_result.get("concentration_flag") not in (None, "UNKNOWN"),
        "documents": [d.lower() for d in raw.get("documents_used") or []],
        "evidence_ok": evidence_ok,
    }


def classify_citation(citation: str, catalog: dict) -> tuple[Optional[str], bool, str]:
    """
    (source kind, verified, reason) for one citation. Kinds: sec_section,
    sec_financials, news, market, portfolio, document, or None if unrecognised.
    """
    c = _norm(citation)
    if not c:
        return None, False, "no citation given"
    for doc in catalog["documents"]:
        if doc in c or c in doc:
            return "document", True, ""
    if "10-q" in c:
        return "sec_section", False, "cites a 10-Q, whose text is never retrieved"
    if "10-k" in c or "sec" in c.split():
        key = _item_key(c)
        if key:
            ticker, fy, item = key
            match = any((ticker is None or t == ticker) and i == item and (fy is None or fy == f)
                        for t, f, i in catalog["sections"])
            return "sec_section", match, "" if match else "cites a 10-K section that was not retrieved"
        # A financials citation may omit the company, but if it names one it must be this one
        named = re.match(r"^([a-z.\-]+) 10-k", c)
        same_company = not named or named.group(1) == catalog["ticker"]
        if not same_company:
            return "sec_financials", False, "cites another company's SEC filing"
        ok = catalog["sec_financials"]
        return "sec_financials", ok, "" if ok else "cites SEC financials that were not available"
    if "portfolio" in c:
        return "portfolio", catalog["portfolio"], "" if catalog["portfolio"] else "portfolio data was not available"
    if "news" in c or "headline" in c:
        return "news", catalog["news"], "" if catalog["news"] else "no news headlines were retrieved"
    if "market" in c or "price" in c or "quote" in c:
        return "market", catalog["market"], "" if catalog["market"] else "market data was not available"
    return None, False, "source not recognised"


def verify_point(point: dict, catalog: dict, default_agent: Optional[str] = None) -> dict:
    """Marks a point with citation_verified (and citation_issue when not verified)."""
    agent = point.get("agent") or default_agent
    kind, ok, reason = classify_citation(point.get("citation"), catalog)
    if ok and agent in _AGENT_SOURCES and kind not in _AGENT_SOURCES[agent]:
        ok, reason = False, f"attributed to {agent.replace('_', ' ')} but cites {kind.replace('_', ' ')}"
    point["citation_verified"] = ok
    if ok:
        point.pop("citation_issue", None)
    else:
        point["citation_issue"] = reason
    return point


def check_points(points: list, catalog: dict, default_agent: Optional[str] = None) -> tuple[int, int]:
    """Verifies a list of points in place; returns (verified, total)."""
    verified = sum(verify_point(p, catalog, default_agent)["citation_verified"] for p in points)
    return verified, len(points)


# ── 3. Confidence policy ─────────────────────────────────────────────────────

def apply_confidence_policy(confidence: float, assessment: dict, verified: int, cited: int) -> dict:
    """
    Final confidence and flags. Returns {"confidence", "disagreement_flag",
    "disagreement_note", "confidence_notes"}.
    """
    notes, note = [], None
    disagreement = assessment["agreement"] is not None and assessment["agreement"] < CONFLICT_THRESHOLD
    if disagreement:
        confidence = min(confidence, CONFLICT_CAP)
        note = "Specialist agents point in opposite directions."

    # Missing evidence = a specialist that was asked to run returned nothing.
    # A question that only needed one specialist is not penalised; it just can't be cross-checked.
    limited = (assessment["signals_available"] == 0 or assessment["coverage"] < MIN_COVERAGE
               or "evidence_agent" in assessment["missing"])
    if limited:
        confidence = min(confidence, LIMITED_EVIDENCE_CAP)
        missing = ", ".join(a.replace("_", " ") for a in assessment["missing"]) or "none"
        notes.append(f"Based on {assessment['signals_available']} of {assessment['signals_requested']} "
                     f"specialist signals (missing: {missing}).")
    elif assessment["agreement"] is None:
        notes.append("Single-specialist view: not cross-checked against other agents.")

    if cited and (cited - verified) / cited > MAX_UNVERIFIED_SHARE:
        confidence = min(confidence, LIMITED_EVIDENCE_CAP)
        notes.append(f"{cited - verified} of {cited} cited points could not be matched to retrieved sources.")

    return {"confidence": round(confidence, 2), "disagreement_flag": disagreement,
            "disagreement_note": note, "confidence_notes": notes}

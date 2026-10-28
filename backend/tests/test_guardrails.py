"""
Guardrails for stock recommendations (app/agents/guardrails.py and the composer):

- direction, agreement and coverage are measured separately, so unanimous
  bearish signals count as agreement and missing evidence is not disagreement;
- confidence is capped in code for genuine conflict, thin coverage and
  unverifiable citations;
- every citation is checked against what each specialist actually retrieved.

The LLM is mocked — no network.
"""
import pytest

from app.agents import recommendation_composer
from app.agents.guardrails import (
    CONFLICT_CAP,
    LIMITED_EVIDENCE_CAP,
    apply_confidence_policy,
    assess_signals,
    citation_catalog,
    verify_point,
)

BULL = {"overall_evidence_tone": "bullish"}
BEAR = {"overall_evidence_tone": "bearish"}


# ── Signal assessment ────────────────────────────────────────────────────────

def test_unanimous_bearish_is_agreement_not_disagreement():
    """T22 - All three specialists bearish: full agreement, negative direction"""
    a = assess_signals({"concentration_flag": "HIGH"}, BEAR, {"market_signal": "bearish"})
    assert a["agreement"] == 1.0
    assert a["direction"] == -1.0 and a["direction_label"] == "negative"
    assert a["coverage"] == 1.0


def test_unanimous_bullish_is_agreement():
    """T23 - All three specialists bullish: full agreement, positive direction"""
    a = assess_signals({"concentration_flag": "LOW"}, BULL, {"market_signal": "bullish"})
    assert (a["agreement"], a["direction"]) == (1.0, 1.0)


def test_bullish_vs_bearish_is_disagreement_even_if_it_averages_neutral():
    """T24 - Opposite signals: agreement 0 although the average direction is neutral"""
    a = assess_signals({"concentration_flag": "LOW"}, BEAR, {"market_signal": "neutral"})
    assert a["agreement"] == 0.0
    assert a["direction"] == 0.0


def test_partial_agreement():
    """T25 - Bullish plus neutral is partial agreement, not conflict"""
    a = assess_signals({"concentration_flag": "MEDIUM"}, BULL, {"market_signal": "bullish"})
    assert a["agreement"] == 0.5


def test_missing_evidence_lowers_coverage_only():
    """T26 - A failed evidence agent reduces coverage and is reported as missing"""
    a = assess_signals({"concentration_flag": "HIGH"}, {"error": "timeout"}, {"market_signal": "bearish"})
    assert a["agreement"] == 1.0
    assert a["coverage"] == 0.67
    assert a["missing"] == ["evidence_agent"]


def test_unrequested_agents_do_not_count_against_coverage():
    """T123 - Agents the supervisor didn't ask for are neither missing nor signals"""
    a = assess_signals({}, BEAR, {}, agents_needed=["evidence_agent"])
    assert a["signals_requested"] == 1 and a["coverage"] == 1.0 and a["missing"] == []
    assert a["agreement"] is None  # one signal cannot agree or disagree


# ── Confidence policy ────────────────────────────────────────────────────────

def _assess(**kw):
    base = assess_signals({"concentration_flag": "HIGH"}, BEAR, {"market_signal": "bearish"})
    return {**base, **kw}


def test_unanimous_bearish_keeps_high_confidence():
    """T124 - A confident sell is allowed when every signal is negative"""
    out = apply_confidence_policy(0.85, _assess(), verified=4, cited=4)
    assert out["confidence"] == 0.85
    assert out["disagreement_flag"] is False and out["confidence_notes"] == []


def test_conflict_caps_confidence_and_flags():
    """T125 - Opposite signals cap confidence and flag disagreement"""
    out = apply_confidence_policy(0.9, _assess(agreement=0.0), verified=4, cited=4)
    assert out["confidence"] == CONFLICT_CAP
    assert out["disagreement_flag"] is True


def test_thin_coverage_caps_without_calling_it_disagreement():
    """T126 - Missing evidence caps confidence with a note, but is not disagreement"""
    a = assess_signals({"concentration_flag": "HIGH"}, {"error": "x"}, {"market_signal": "bearish"})
    out = apply_confidence_policy(0.9, a, verified=2, cited=2)
    assert out["confidence"] == LIMITED_EVIDENCE_CAP
    assert out["disagreement_flag"] is False
    assert "2 of 3" in out["confidence_notes"][0] and "evidence agent" in out["confidence_notes"][0]


def test_single_requested_specialist_is_noted_not_penalised():
    """T134 - Only one specialist needed: no cap, but a note that it wasn't cross-checked"""
    a = assess_signals({}, BEAR, {}, agents_needed=["evidence_agent"])
    out = apply_confidence_policy(0.8, a, verified=3, cited=3)
    assert out["confidence"] == 0.8
    assert out["confidence_notes"] == ["Single-specialist view: not cross-checked against other agents."]


def test_no_signals_at_all_caps_confidence():
    """T135 - With no usable signal from any specialist, confidence is capped"""
    a = assess_signals({"concentration_flag": "UNKNOWN"}, {"error": "x"}, {"market_signal": "unknown"})
    assert apply_confidence_policy(0.9, a, verified=0, cited=0)["confidence"] == LIMITED_EVIDENCE_CAP


def test_unverified_citations_cap_confidence():
    """T127 - More than a third of cited points unverifiable caps confidence"""
    out = apply_confidence_policy(0.9, _assess(), verified=2, cited=4)
    assert out["confidence"] == LIMITED_EVIDENCE_CAP
    assert "2 of 4 cited points" in out["confidence_notes"][0]


# ── Citation verification ────────────────────────────────────────────────────

EVIDENCE = {
    "overall_evidence_tone": "bearish",
    "raw_evidence": {
        "passage_citations": ["MSFT 10-K FY2026, Item 1A Risk Factors"],
        "sec_financials_text": "Official SEC financials …",
        "headline_count": 0,
        "price": {"current_price": 400.0},
        "documents_used": ["analyst-note.pdf"],
    },
}
CATALOG = citation_catalog("MSFT", {"concentration_flag": "HIGH"}, EVIDENCE, {"market_signal": "bearish"})


@pytest.mark.parametrize("citation, agent, ok", [
    ("MSFT 10-K FY2026, Item 1A Risk Factors", "evidence_agent", True),
    ("MSFT 10-K FY2026, Item 1A", None, True),                      # shortened form of a retrieved section
    ("MSFT 10-K FY2026, Item 7 MD&A", None, False),                 # section that was never retrieved
    ("AAPL 10-K FY2026, Item 1A Risk Factors", None, False),        # another company
    ("MSFT 10-K FY2026 financials", "evidence_agent", True),
    ("news headlines", None, False),                                # no headlines were retrieved
    ("market data", "market_data_agent", True),
    ("portfolio data", "portfolio_agent", True),
    ("analyst-note.pdf", "evidence_agent", True),
    ("MSFT 10-K FY2026, Item 1A Risk Factors", "portfolio_agent", False),  # wrong specialist for the source
    ("Bloomberg", None, False),
    ("", None, False),
])
def test_citations_must_match_what_each_specialist_retrieved(citation, agent, ok):
    """T128 - Each citation is checked against the sources its specialist actually had"""
    point = verify_point({"point": "x", "citation": citation, **({"agent": agent} if agent else {})}, CATALOG)
    assert point["citation_verified"] is ok
    assert ("citation_issue" in point) is (not ok)


# ── Composer end to end (LLM mocked) ─────────────────────────────────────────

def _compose(monkeypatch, llm_output, evidence=EVIDENCE, market=None, portfolio=None):
    seen = {}

    def fake_llm(system_prompt, user_prompt, **kw):
        seen["prompt"] = user_prompt
        return dict(llm_output)

    monkeypatch.setattr(recommendation_composer, "invoke_llm_json", fake_llm)
    result = recommendation_composer.compose_recommendation(
        query="What are Microsoft's biggest risks?", ticker="MSFT", intent="single_position",
        portfolio_result=portfolio or {"concentration_flag": "HIGH", "investor_profile": "moderate"},
        evidence_result=evidence, market_result=market or {"market_signal": "bearish", "current_price": 400.0},
    )
    return result, seen["prompt"]


GOOD_OUTPUT = {
    "answer": "Regulation and competition are the main risks.",
    "action": "sell", "confidence": 0.85, "summary": "All signals negative.",
    "key_points": [{"point": "Antitrust scrutiny", "citation": "MSFT 10-K FY2026, Item 1A Risk Factors"},
                   {"point": "Down 3% today", "citation": "market data"}],
    "evidence_for": [],
    "evidence_against": [{"point": "Position is 40% of portfolio", "agent": "portfolio_agent", "citation": "portfolio data"}],
    "disagreement_flag": True, "disagreement_note": "model thinks they disagree",
}


def test_composer_allows_confident_sell_on_unanimous_bearish(monkeypatch):
    """T129 - Unanimous bearish: the model's confidence stands and the model's false disagreement flag is overruled"""
    result, prompt = _compose(monkeypatch, GOOD_OUTPUT)
    assert result["confidence"] == 0.85
    assert result["disagreement_flag"] is False and result["disagreement_note"] is None
    assert result["signal_assessment"]["agreement"] == 1.0
    assert result["citation_check"] == {"verified": 3, "cited": 3, "evidence_signals_withheld": 0, "withheld": []}
    assert "Agreement: 1.0" in prompt and "NOT a confidence measure" in prompt


def test_composer_flags_and_marks_fabricated_citations(monkeypatch):
    """T130 - Points citing sources that weren't retrieved are marked, and confidence is capped"""
    output = {**GOOD_OUTPUT, "key_points": [
        {"point": "Cloud margins fell", "citation": "MSFT 10-K FY2026, Item 7 MD&A"},
        {"point": "Analysts downgraded", "citation": "Bloomberg"},
    ]}
    result, _ = _compose(monkeypatch, output)
    assert [p["citation_verified"] for p in result["key_points"]] == [False, False]
    assert result["key_points"][0]["citation_issue"] == "cites a 10-K section that was not retrieved"
    assert result["confidence"] == LIMITED_EVIDENCE_CAP
    assert any("could not be matched" in n for n in result["confidence_notes"])


def test_composer_withholds_unverifiable_evidence_signals(monkeypatch):
    """T131 - The evidence agent's signals with bad citations never reach the composer"""
    evidence = {**EVIDENCE, "evidence_against": [
        {"signal": "Antitrust scrutiny", "citation": "MSFT 10-K FY2026, Item 1A Risk Factors"},
        {"signal": "Invented headline", "citation": "news headlines"},
    ]}
    result, prompt = _compose(monkeypatch, GOOD_OUTPUT, evidence=evidence)
    assert "Antitrust scrutiny" in prompt and "Invented headline" not in prompt
    assert result["citation_check"]["evidence_signals_withheld"] == 1
    assert result["citation_check"]["withheld"] == [{"citation": "news headlines", "issue": "no news headlines were retrieved"}]


def test_composer_conflict_caps_confidence(monkeypatch):
    """T132 - Bullish evidence against bearish market and portfolio caps confidence and flags it"""
    evidence = {**EVIDENCE, "overall_evidence_tone": "bullish"}
    result, _ = _compose(monkeypatch, GOOD_OUTPUT, evidence=evidence)
    assert result["confidence"] == CONFLICT_CAP
    assert result["disagreement_flag"] is True
    assert result["disagreement_note"] == "model thinks they disagree"


def test_composer_reports_missing_evidence(monkeypatch):
    """T133 - A failed evidence agent caps confidence with a note naming what's missing"""
    evidence = {**EVIDENCE, "error": "SEC timeout"}
    result, _ = _compose(monkeypatch, GOOD_OUTPUT, evidence=evidence)
    assert result["confidence"] == LIMITED_EVIDENCE_CAP
    assert result["disagreement_flag"] is False
    assert any("evidence agent" in n for n in result["confidence_notes"])


def test_decision_journal_saves_to_db(auth_client):
    """T27 - Decision journal endpoint returns list"""
    r = auth_client.get("/decisions/journal")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

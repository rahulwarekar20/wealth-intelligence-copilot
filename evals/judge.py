"""
LLM-as-judge for faithfulness (metric M3).

The judge sees exactly the data the agent retrieved (the Evidence Agent's
input: SEC financials, 10-K excerpts, quote, news, documents; and the
Composer's input: portfolio and market agent outputs) and labels every claim in
the final answer SUPPORTED, NOT_SUPPORTED or CONTRADICTED.

Judge model: qwen/qwen3.8-27b on Groq (free tier). It is deliberately a different
model family from the agent (gpt-oss-20b / gpt-oss-120b) to avoid
self-preference. Calibrated against human labels in judge_calibration.csv.
"""
import json
import re
import time

import httpx

from app.core.config import settings

JUDGE_MODEL = "qwen/qwen3.8-27b"
JUDGE_PROMPT_VERSION = "faith-v1"

JUDGE_SYSTEM = """You are a strict fact-checker for an investment research assistant.

You get SOURCE DATA (everything the assistant retrieved) and a numbered list of CLAIMS
from its answer. Label each claim:

- SUPPORTED: every fact and number in the claim appears in, or follows by simple arithmetic
  or rounding (within 1 in the last digit) from, the SOURCE DATA. Paraphrase is fine.
  Opinions/recommendations ("hold", "keep additions small") are SUPPORTED if the reasons they give are in the data.
- NOT_SUPPORTED: the claim states a fact or number that is not in the SOURCE DATA
  (outside knowledge counts as NOT_SUPPORTED, even if true in the real world).
- CONTRADICTED: the claim conflicts with the SOURCE DATA (wrong number, wrong direction, wrong year).

Statements that some data is unavailable are SUPPORTED if it is indeed absent from the SOURCE DATA.

Respond with JSON only:
{"labels": [{"n": 1, "label": "SUPPORTED|NOT_SUPPORTED|CONTRADICTED", "reason": "max 15 words"}]}"""



def _ticker_of(call: dict):
    """Ticker an evidence / composer call was about, read from its prompt."""
    m = re.search(r"(?:Analyze this evidence for|Ticker:) ([A-Z][A-Z0-9.\-]*)", call["user"])
    return m.group(1) if m else None


def _market_end(text: str, start: int) -> int:
    """End of the market-data block: the first section after it (SEC table, citation list, assessment)."""
    ends = [i for i in (text.find(k, start) for k in ("Official SEC financials", "SEC FILINGS:",
                                                       "ALLOWED CITATIONS", "SIGNAL ASSESSMENT")) if i > 0]
    return min(ends) if ends else len(text)


def _source_data(llm_io: list[dict], ticker=None) -> str:
    """
    The retrieved data, taken from the prompts the agent's own LLM calls received:
    the Evidence Agent's input (raw SEC / market / news / documents) and the
    portfolio + market part of the Composer's input. The SEC table that the v3
    composer also receives is a copy of what the Evidence Agent saw, so it is not
    repeated. With `ticker`, only that stock's calls are used.
    """
    blocks = []
    for call in llm_io:
        if ticker and call["name"] in ("analyze_evidence", "compose_recommendation") and _ticker_of(call) != ticker:
            continue
        if call["name"] == "analyze_evidence":
            blocks.append("=== EVIDENCE RETRIEVED ===\n" + call["user"])
        elif call["name"] == "compose_recommendation":
            # Keep only the portfolio / market part; the evidence part is the agent's own summary
            text = call["user"]
            cut = text.find("EVIDENCE AGENT OUTPUT")
            market = text.find("MARKET DATA AGENT OUTPUT")
            portfolio_part = text[:cut] if cut > 0 else text
            market_part = text[market:_market_end(text, market)] if market > 0 else ""
            blocks.append("=== PORTFOLIO & MARKET DATA ===\n" + portfolio_part + "\n" + market_part)
        elif call["name"] == "compose_comparison" and ticker is None:
            blocks.append("=== PER-STOCK FACTS GIVEN TO THE COMPARISON ===\n" + call["user"])
    return "\n\n".join(blocks)


def _claims(output: dict) -> list:
    """(ticker, claim) for every claim in the answer; the comparison verdict has ticker None."""
    from evaluators import stock_results
    claims = []
    for r in stock_results(output):
        t = r.get("ticker")
        if r.get("answer"):
            claims.append((t, f"[{t} answer] {r['answer']}"))
        for side in ("key_points", "evidence_for", "evidence_against"):
            for p in r.get(side) or []:
                claims.append((t, f"[{t}] {p.get('point')}"))
    if output.get("verdict"):
        claims.append((None, f"[comparison verdict] {output['verdict']}"))
    return claims


def _call(system: str, user: str, max_tokens: int = 3000) -> dict:
    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
    payload = {"model": JUDGE_MODEL, "temperature": 0, "max_tokens": max_tokens,
               "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    for attempt in range(60):
        r = httpx.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=120)
        if r.status_code == 429:
            m = re.search(r"try again in ([0-9.]+)(ms|s)", r.text)
            wait = (float(m.group(1)) / (1000 if m.group(2) == "ms" else 1)) if m else 10
            time.sleep(min(wait, 60) + 1)
            continue
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"]
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.S)
        s, e = content.find("{"), content.rfind("}") + 1
        return json.loads(content[s:e])
    raise RuntimeError("judge rate-limited too long")


def _judge_group(claims: list[str], source: str) -> list[dict]:
    user = f"SOURCE DATA:\n{source}\n\nCLAIMS:\n" + "\n".join(f"{i}. {c}" for i, c in enumerate(claims, 1))
    res = _call(JUDGE_SYSTEM, user)
    labels = {int(l.get("n", 0)): l for l in res.get("labels") or [] if isinstance(l, dict)}
    return [labels.get(i) or {"label": "NOT_SUPPORTED", "reason": "judge gave no label"}
            for i in range(1, len(claims) + 1)]


def judge_faithfulness(output: dict, llm_io: list[dict]):
    """
    Labels every claim. A single-stock answer is judged in one call. A comparison
    is judged one stock at a time against that stock's own retrieved data (keeps
    each request under the provider's size limit), and the verdict against the
    per-stock facts it was written from.
    Returns {"supported", "total", "passed", "labels"}, or None when there is nothing to judge.
    """
    claims = _claims(output)
    if not claims:
        return None
    comparison = output.get("route") == "comparison"
    groups: dict = {}
    for t, c in claims:
        groups.setdefault(t if comparison else "all", []).append(c)
    rows = []
    try:
        for key, group in groups.items():
            source = _source_data(llm_io, ticker=key) if comparison and key else _source_data(llm_io)
            for c, l in zip(group, _judge_group(group, source)):
                rows.append({"n": len(rows) + 1, "claim": c, "label": l.get("label"), "reason": l.get("reason")})
    except Exception as e:
        return {"error": str(e), "supported": None, "total": len(claims), "passed": None, "labels": rows}
    supported = sum(1 for r in rows if r["label"] == "SUPPORTED")
    return {"supported": supported, "total": len(rows), "passed": supported == len(rows),
            "labels": rows, "judge_model": JUDGE_MODEL, "judge_prompt_version": JUDGE_PROMPT_VERSION}

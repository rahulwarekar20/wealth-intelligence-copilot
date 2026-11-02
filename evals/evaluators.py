"""
Evaluators for the golden dataset. Five metrics, each tied to the Week 3
success definition ("an investor goes from question to a decision they would
act on in under 2 minutes, with every cited point verified, 8 times out of 10"):

  M1 handling_correct    code / exact match   right route and right ticker(s)
  M2 citation_integrity  code                 every cited point matched to a retrieved source
  M3 faithfulness        LLM-as-judge         every claim supported by the retrieved data
  M4 policy_compliance   code                 the case's labelled behaviour checks
  M5 latency + cost      code                 p50/p95 latency, tokens and $ per question

task_success = all applicable metrics pass for the case (the Week 3 "8 out of 10").
"""
import json
import re

LATENCY_LIMIT_S = 120.0

# Groq list prices (USD per 1M tokens) used for the cost-per-question estimate.
# The eval itself ran on the free tier ($0); these show what production would pay.
PRICES = {
    "openai/gpt-oss-20b": {"in": 0.075, "out": 0.30},
    "openai/gpt-oss-120b": {"in": 0.15, "out": 0.60},
}

ANSWER_ROUTES = ("recommendation", "comparison")


def stock_results(output: dict) -> list[dict]:
    """The per-ticker recommendation dicts in an answer (one, or several for a comparison)."""
    if output.get("route") == "recommendation":
        return [output]
    if output.get("route") == "comparison":
        return output.get("results") or []
    return []


def analysed_tickers(output: dict) -> list[str]:
    return [r.get("ticker") for r in stock_results(output)]


def answer_text(output: dict) -> str:
    """All user-visible text of the answer, lower-cased, for mentions checks."""
    parts = [output.get("message"), output.get("verdict"), output.get("note")]
    for r in stock_results(output):
        parts += [r.get("answer"), r.get("summary"), r.get("disagreement_note")]
        parts += r.get("confidence_notes") or []
        for side in ("key_points", "evidence_for", "evidence_against"):
            parts += [p.get("point") for p in r.get(side) or []]
    return " ".join(str(p) for p in parts if p).lower()


# ── M1 ───────────────────────────────────────────────────────────────────────

def handling_correct(case: dict, output: dict) -> tuple[bool, str]:
    exp = case["expected"]
    route = output.get("route") or ("error" if output.get("error") else None)
    routes = exp.get("route_any_of") or [exp["route"]]
    if route not in routes:
        return False, f"route {route} (expected {'/'.join(routes)})"
    if route not in ANSWER_ROUTES:
        return True, "route ok"
    got = set(analysed_tickers(output))
    if "tickers_any_of" in exp:
        ok = any(got == set(t) for t in exp["tickers_any_of"])
        return ok, f"tickers {sorted(got)}"
    if "tickers_subset_of" in exp:
        ok = got <= set(exp["tickers_subset_of"]) and len(got) == exp.get("tickers_count", len(got))
        return ok, f"tickers {sorted(got)}"
    ok = got == set(exp.get("tickers") or [])
    return ok, f"tickers {sorted(got)} (expected {sorted(exp.get('tickers') or [])})"


# ── M2 ───────────────────────────────────────────────────────────────────────

def citation_integrity(output: dict):
    """(verified, cited, passed) over every answer card; None when not an answer."""
    results = stock_results(output)
    if not results:
        return None
    verified = cited = 0
    for r in results:
        cc = r.get("citation_check") or {}
        verified += cc.get("verified", 0)
        cited += cc.get("cited", 0)
    return {"verified": verified, "cited": cited, "passed": cited > 0 and verified == cited}


# ── M4 ───────────────────────────────────────────────────────────────────────

_NUMBER = re.compile(r"\d")


def policy_compliance(case: dict, output: dict) -> tuple[bool, list[str]]:
    """Runs the case's labelled checks. Returns (passed, failures)."""
    checks = case["expected"].get("checks") or {}
    fails = []
    results = stock_results(output)
    text = answer_text(output)
    for name, want in checks.items():
        if name == "action_not_in":
            bad = [r["ticker"] + ":" + r.get("action", "") for r in results if r.get("action") in want]
            if bad:
                fails.append(f"forbidden action {bad}")
        elif name == "action_in":
            bad = [r["ticker"] + ":" + r.get("action", "") for r in results if r.get("action") not in want]
            if bad:
                fails.append(f"action not in {want}: {bad}")
        elif name == "max_confidence":
            bad = [r.get("confidence") for r in results if (r.get("confidence") or 0) > want]
            if bad:
                fails.append(f"confidence {bad} > {want}")
        elif name == "mentions_any":
            if not any(w.lower() in text for w in want):
                fails.append(f"mentions none of {want}")
        elif name == "not_mentions":
            hit = [w for w in want if w.lower() in text]
            if hit:
                fails.append(f"mentions {hit}")
        elif name == "key_points_cite_any":
            cites = " ".join(str(p.get("citation", "")) for r in results for p in r.get("key_points") or []).lower()
            if not any(w.lower() in cites for w in want):
                fails.append(f"no key point cites {want}")
        elif name == "has_risks":
            if results and not all(r.get("evidence_against") for r in results):
                fails.append("no risks listed")
        elif name == "answer_has_number":
            if results and not all(_NUMBER.search(str(r.get("answer", ""))) for r in results):
                fails.append("direct answer quotes no figure")
        elif name == "preferred_in":
            if output.get("route") == "comparison" and output.get("preferred") not in want:
                fails.append(f"preferred {output.get('preferred')}")
        else:
            fails.append(f"unknown check {name}")
    # Checks that only make sense on an answer fail if the case was not answered
    needs_answer = {"action_not_in", "action_in", "max_confidence", "key_points_cite_any", "has_risks", "answer_has_number"}
    if needs_answer & set(checks) and not results:
        fails.append("no answer to check")
    return not fails, fails


# ── M5 ───────────────────────────────────────────────────────────────────────

def cost_usd(tokens_by_model: dict) -> float:
    total = 0.0
    for model, t in tokens_by_model.items():
        p = PRICES.get(model)
        if p:
            total += t["prompt"] / 1e6 * p["in"] + t["completion"] / 1e6 * p["out"]
    return round(total, 6)


# ── Per-case scoring ─────────────────────────────────────────────────────────

def score_case(case: dict, run: dict, faith: dict | None) -> dict:
    out = run["output"]
    m1, m1_why = handling_correct(case, out)
    m2 = citation_integrity(out)
    m4, m4_fails = policy_compliance(case, out)
    latency_ok = run["latency_s"] <= LATENCY_LIMIT_S
    answered = out.get("route") in ANSWER_ROUTES
    faithful = None if not answered or faith is None else faith.get("passed")

    parts = [m1, m4, latency_ok]
    if answered:
        parts.append(bool(m2 and m2["passed"]))
        if faithful is not None:
            parts.append(faithful)
    return {
        "handling_correct": m1, "handling_detail": m1_why,
        "citation_integrity": None if m2 is None else m2["passed"],
        "citations_verified": None if m2 is None else m2["verified"],
        "citations_total": None if m2 is None else m2["cited"],
        "faithful": faithful,
        "faith_supported": None if not faith else faith.get("supported"),
        "faith_total": None if not faith else faith.get("total"),
        "policy_compliance": m4, "policy_failures": m4_fails,
        "latency_ok": latency_ok,
        "cost_usd": cost_usd(run["tokens_by_model"]),
        "task_success": all(parts),
    }


def summarise_output(out: dict) -> str:
    """One-line human-readable summary of the agent's answer for the spreadsheet."""
    if out.get("error"):
        return f"ERROR: {out['error']}"[:300]
    route = out.get("route")
    if route == "recommendation":
        return (f"{out.get('ticker')} {str(out.get('action', '')).upper()} @ {out.get('confidence')} — "
                f"{out.get('answer', '')}")[:500]
    if route == "comparison":
        cards = "; ".join(f"{r.get('ticker')} {str(r.get('action', '')).upper()} @ {r.get('confidence')}"
                          for r in out.get("results") or [])
        return f"[{cards}] preferred={out.get('preferred')} — {out.get('verdict', '')}"[:500]
    if route == "clarify":
        return f"CLARIFY: {out.get('message', '')}"[:300]
    return f"{str(route).upper()} (routed; agent stubbed in eval)"


def dumps(o) -> str:
    return json.dumps(o, ensure_ascii=False, default=str)

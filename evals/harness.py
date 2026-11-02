"""
Runs the real copilot pipeline (ask_service.answer_question: supervisor ->
specialists -> guardrails -> composer) outside the web app, one golden case
at a time, and records a trace per case.

What is real and what is replaced:
  real      every LLM call (Groq), SEC EDGAR, Finnhub, all agent and guardrail code
  replaced  the PostgreSQL lookups (holdings, profile, evidence cache, documents,
            journal writes) -> in-memory fixtures defined by each case
  stubbed   the portfolio-strategy and retirement agents: only the ROUTING to
            them is evaluated here; their own quality is out of scope

External HTTP GETs (SEC, Finnhub) are recorded to evals/.cache on the first run
and replayed afterwards, so the baseline and the improved run see identical
market data and filings; any change in scores comes from the agent.

Instrumentation: every LLM call is a child "llm" span (model, latency, tokens,
status) and every data fetch a child "tool" span. Groq free-tier 429s are
waited out here and recorded as rate_limit_wait_s, so provider queueing is not
counted as an agent failure or as agent latency.
"""
import hashlib
import inspect
import json
import os
import pickle
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

REPO = Path(__file__).resolve().parent.parent
BACKEND = REPO / "backend"
CACHE_DIR = Path(__file__).resolve().parent / ".cache"

# The backend reads backend/.env relative to the working directory
os.chdir(BACKEND)
sys.path.insert(0, str(BACKEND))

import httpx  # noqa: E402

from app.agents import llm_client  # noqa: E402
from app.agents import evidence_agent, market_data_agent, portfolio_agent  # noqa: E402
from app.services import ask_service, evidence_service, portfolio_service, sec_service  # noqa: E402
from app.services.profile_service import concentration_limits  # noqa: E402


# ── Trace recording ──────────────────────────────────────────────────────────

class Trace:
    """Spans for one case. Cases run one at a time, so a lock is enough even
    though the agents fan out to threads."""

    def __init__(self):
        self.lock = threading.Lock()
        self.spans: list[dict] = []
        self.llm_io: list[dict] = []   # full prompts/responses, kept for the faithfulness judge

    def add(self, span: dict):
        with self.lock:
            self.spans.append(span)


_current: Trace | None = None
_LLM_CALLERS = ("classify_intent", "analyze_evidence", "compose_recommendation", "compose_comparison",
                "run_retirement_analysis", "run_portfolio_strategy")


def _llm_caller() -> str:
    """Name of the agent function that made this LLM call."""
    for frame in inspect.stack():
        if frame.function in _LLM_CALLERS:
            return frame.function
    return "llm"


# ── Instrumented, rate-limit-tolerant LLM transport ──────────────────────────

_real_post = httpx.post
MAX_429_RETRIES = 12


def _llm_post(url, headers=None, json=None, timeout=None, **kw):
    """Wraps the Groq HTTP call: records an llm span and waits out 429s."""
    caller = _llm_caller()
    waited = 0.0
    started = time.time()
    for _ in range(MAX_429_RETRIES):
        t0 = time.time()
        resp = _real_post(url, headers=headers, json=json, timeout=timeout, **kw)
        if resp.status_code != 429:
            break
        wait = min(max(llm_client._rate_limit_wait(resp), 1.0), 30.0) + 0.5
        waited += (time.time() - t0) + wait
        time.sleep(wait)
    usage = {}
    content = None
    try:
        body = resp.json()
        usage = body.get("usage") or {}
        content = body["choices"][0]["message"]["content"]
    except Exception:
        pass
    span = {
        "id": str(uuid.uuid4()), "type": "llm", "name": caller, "model": (json or {}).get("model"),
        "start": started, "latency_s": round(time.time() - started - waited, 3),
        "rate_limit_wait_s": round(waited, 2), "status": resp.status_code,
        "prompt_tokens": usage.get("prompt_tokens", 0), "completion_tokens": usage.get("completion_tokens", 0),
        "reasoning_tokens": (usage.get("completion_tokens_details") or {}).get("reasoning_tokens", 0),
        "max_tokens": (json or {}).get("max_tokens"),
        "error": None if resp.status_code == 200 and content else f"HTTP {resp.status_code}" if resp.status_code != 200 else "empty content",
    }
    if _current:
        _current.add(span)
        msgs = (json or {}).get("messages") or []
        _current.llm_io.append({"span_id": span["id"], "name": caller,
                                "system": msgs[0]["content"] if msgs else "",
                                "user": msgs[1]["content"] if len(msgs) > 1 else "",
                                "response": content})
    return resp


class _HttpxProxy:
    """Stands in for the httpx module inside llm_client only: post() is instrumented."""
    def __getattr__(self, name):
        return getattr(httpx, name)

    post = staticmethod(_llm_post)


# ── Record / replay of external data (SEC, Finnhub) ──────────────────────────

class _ReplayGet:
    """httpx.get replacement: replays a recorded response for the same URL, or
    records a new one. API tokens are stripped from cache keys."""

    def __init__(self):
        CACHE_DIR.mkdir(exist_ok=True)
        self.lock = threading.Lock()
        self.hits = self.misses = 0

    @staticmethod
    def _key(url, params) -> str:
        # params=None would wipe the query string, so only pass it when given
        u = httpx.URL(url, params=params) if params else httpx.URL(url)
        q = sorted((k, v) for k, v in u.params.multi_items() if k not in ("token", "apikey"))
        return hashlib.sha256(f"{u.copy_with(query=None)}?{q}".encode()).hexdigest()

    def __call__(self, url, params=None, **kw):
        path = CACHE_DIR / (self._key(url, params) + ".pkl")
        if path.exists():
            with open(path, "rb") as f:
                status, headers, content = pickle.load(f)
            self.hits += 1
            # content is stored decoded; drop encoding headers so it isn't decoded twice
            headers = {k: v for k, v in headers.items() if k.lower() not in ("content-encoding", "content-length", "transfer-encoding")}
            return httpx.Response(status, headers=headers, content=content, request=httpx.Request("GET", url))
        resp = httpx.get(url, params=params, **kw)
        self.misses += 1
        if resp.status_code < 500 and resp.status_code != 429:
            with self.lock, open(path, "wb") as f:
                pickle.dump((resp.status_code, dict(resp.headers), resp.content), f)
        return resp


replay_get = _ReplayGet()


class _GetProxy:
    """Stands in for httpx inside the data services: get() goes through record/replay."""
    def __getattr__(self, name):
        return getattr(httpx, name)

    get = staticmethod(replay_get)


# ── Tool spans ───────────────────────────────────────────────────────────────

def _tool(name, fn):
    """Wraps a data-fetching function so each call becomes a 'tool' span."""
    def wrapped(*a, **kw):
        t0 = time.time()
        err = None
        try:
            out = fn(*a, **kw)
            if isinstance(out, dict) and out.get("error"):
                err = str(out["error"])[:200]
            return out
        except Exception as e:
            err = str(e)[:200]
            raise
        finally:
            if _current:
                _current.add({"id": str(uuid.uuid4()), "type": "tool", "name": name, "start": t0,
                              "latency_s": round(time.time() - t0, 3), "error": err,
                              "args": [str(x) for x in a[:1]]})
    return wrapped


# ── In-memory replacements for the database ──────────────────────────────────

class FakeDB:
    """Passed where the app expects a SQLAlchemy session. Every DB-touching
    function the pipeline calls is patched below, so this is never queried."""
    def get_bind(self):
        return None

    def close(self):
        pass


class EvalContext:
    """The investor (holdings, profile, documents) for the case being run."""
    holdings: list = []
    profile: dict = {}
    documents: list = []


ctx = EvalContext()
_evidence_store: dict = {}
_store_lock = threading.Lock()


def _save_evidence_item(db=None, ticker="", source_type="", payload=None, reliability_weight=1.0):
    item = SimpleNamespace(id=uuid.uuid4(), ticker=ticker.upper(), source_type=source_type, payload=payload,
                           reliability_weight=reliability_weight, retrieved_at=datetime.now(timezone.utc))
    with _store_lock:
        _evidence_store[(ticker.upper(), source_type)] = item
    return item


def _get_latest_evidence(db, ticker, source_type):
    return _evidence_store.get((ticker.upper(), source_type))


def _get_evidence_by_ticker(db, ticker, limit=10):
    return [v for (t, _), v in _evidence_store.items() if t == ticker.upper()][:limit]


def _get_holdings(db, user_id):
    return list(ctx.holdings)


def _get_profile(db, user_id):
    return dict(ctx.profile)


def _find_relevant_excerpts(db, user_id, terms, max_excerpts=4, window=300):
    import re
    terms = [t for t in terms if t and len(t) >= 2]
    if not terms:
        return []
    pattern = re.compile(r"\b(" + "|".join(re.escape(t) for t in terms) + r")\b", re.IGNORECASE)
    out = []
    for doc in ctx.documents:
        m = pattern.search(doc["text"])
        if m:
            s, e = max(0, m.start() - window // 2), min(len(doc["text"]), m.end() + window // 2)
            out.append({"document": doc["filename"], "excerpt": doc["text"][s:e].replace("\n", " ").strip()})
        if len(out) >= max_excerpts:
            break
    return out


def _stub_strategy(db, user_id, runner=None, **kw):
    if not ctx.holdings:
        return {"no_holdings": True}
    return {"stubbed": True, "note": "portfolio strategy agent not run in this eval (routing only)"}


def _stub_retirement(query, user_id, db, history=None):
    return {"stubbed": True, "note": "retirement agent not run in this eval (routing only)"}


def install():
    """Applies every patch. Call once before running cases."""
    llm_client.httpx = _HttpxProxy()
    for mod in (evidence_service, sec_service, market_data_agent, portfolio_service):
        mod.httpx = _GetProxy()

    for mod in (evidence_service, sec_service):
        mod.save_evidence_item = _save_evidence_item
        mod.get_latest_evidence = _get_latest_evidence
    evidence_service.get_evidence_by_ticker = _get_evidence_by_ticker

    # Worker threads open their own sessions; give them fake ones too
    from app.agents import graph
    for mod in (graph, evidence_agent, ask_service):
        mod.sessionmaker = lambda **kw: FakeDB

    ask_service.get_holdings = _get_holdings
    portfolio_agent.get_holdings = _get_holdings
    portfolio_agent.get_profile = _get_profile
    evidence_agent.find_relevant_excerpts = _find_relevant_excerpts
    ask_service._save_recommendation = lambda db, user_id, ticker, query, rec: str(uuid.uuid4())
    ask_service.get_or_run_strategy = _stub_strategy
    ask_service.run_retirement_analysis = _stub_retirement

    # Tool spans: the five data tools from the Week 3 design
    evidence_agent.gather_evidence = _tool("finnhub.gather_evidence", evidence_agent.gather_evidence)
    evidence_agent.gather_sec_evidence = _tool("sec_edgar.gather_sec_evidence", evidence_agent.gather_sec_evidence)
    evidence_agent.find_relevant_excerpts = _tool("documents.search", evidence_agent.find_relevant_excerpts)
    from app.agents import graph
    graph.analyze_market_context = _tool("market_data_agent", graph.analyze_market_context)
    graph.analyze_portfolio_impact = _tool("portfolio_agent", graph.analyze_portfolio_impact)
    ask_service.fetch_current_price = _tool("finnhub.quote(ticker check)", ask_service.fetch_current_price)


# ── Fixtures ─────────────────────────────────────────────────────────────────

def _profile(risk="moderate", horizon=None, max_pct=25.0, is_set=True) -> dict:
    return {"risk_tolerance": risk, "horizon_years": horizon, "max_position_pct": max_pct,
            "limits": concentration_limits(max_pct), "is_set": is_set}


def _holdings(rows) -> list:
    return [SimpleNamespace(id=uuid.uuid4(), ticker=t, quantity=q, cost_basis=c, account_type="taxable")
            for t, q, c in rows]


DEMO = [("AAPL", 10, 150.0), ("GOOGL", 5, 120.0), ("SPY", 20, 400.0), ("JPM", 15, 140.0), ("MSFT", 8, 280.0)]

FIXTURES = {
    # The seeded demo account: moderate defaults (profile not set), 25% limit
    "demo": {"holdings": DEMO, "profile": _profile(is_set=False)},
    # Same holdings, conservative investor, 10% limit, 3-year horizon
    "conservative": {"holdings": DEMO, "profile": _profile("conservative", 3, 10.0)},
    # Aggressive investor, long horizon, 40% limit
    "aggressive": {"holdings": DEMO, "profile": _profile("aggressive", 20, 40.0)},
    # One position dominates: NVDA is ~85% of the portfolio against a 20% limit
    "concentrated": {"holdings": [("NVDA", 400, 60.0), ("AAPL", 20, 180.0), ("KO", 50, 55.0)],
                     "profile": _profile("moderate", 10, 20.0)},
    # New user with nothing yet
    "empty": {"holdings": [], "profile": _profile(is_set=False)},
}


def set_investor(fixture: str, documents: list | None = None):
    f = FIXTURES[fixture]
    ctx.holdings = _holdings(f["holdings"])
    ctx.profile = f["profile"]
    ctx.documents = documents or []


# ── Running one case ─────────────────────────────────────────────────────────

def run_case(case: dict) -> dict:
    """Runs one golden case through answer_question and returns output + trace."""
    global _current
    set_investor(case["fixture"], case.get("documents"))
    _current = Trace()
    t0 = time.time()
    error = None
    try:
        output = ask_service.answer_question(case["input"], case.get("history") or [], "eval-user", FakeDB())
    except Exception as e:  # a crash is a result too
        output = {"error": f"exception: {type(e).__name__}: {e}"}
        error = output["error"]
    wall = time.time() - t0
    trace, _current = _current, None

    llm = [s for s in trace.spans if s["type"] == "llm"]
    waited = sum(s["rate_limit_wait_s"] for s in llm)
    # Parallel branches can overlap waits; never report negative latency
    agent_latency = max(wall - waited, sum(s["latency_s"] for s in llm) / max(len(llm), 1))
    return {
        "output": output,
        "error": error or output.get("error"),
        "wall_s": round(wall, 2),
        "rate_limit_wait_s": round(waited, 2),
        "latency_s": round(agent_latency, 2),
        "llm_calls": len(llm),
        "tool_calls": sum(1 for s in trace.spans if s["type"] == "tool"),
        "prompt_tokens": sum(s["prompt_tokens"] for s in llm),
        "completion_tokens": sum(s["completion_tokens"] for s in llm),
        "tokens_by_model": _tokens_by_model(llm),
        "spans": sorted(trace.spans, key=lambda s: s["start"]),
        "llm_io": trace.llm_io,
        "started_at": datetime.fromtimestamp(t0, tz=timezone.utc).isoformat(),
    }


def _tokens_by_model(llm_spans) -> dict:
    out: dict = {}
    for s in llm_spans:
        m = out.setdefault(s["model"], {"prompt": 0, "completion": 0})
        m["prompt"] += s["prompt_tokens"]
        m["completion"] += s["completion_tokens"]
    return out

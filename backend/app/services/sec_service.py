"""
SEC EDGAR integration: official financials and filing text for US-listed companies.

- Ticker -> CIK via https://www.sec.gov/files/company_tickers.json
- Annual financials from the XBRL "company facts" API (exact reported figures)
- Latest 10-K / 10-Q via the submissions API
- Risk Factors (Item 1A) and MD&A (Item 7) text from the latest 10-K

SEC asks every client to send a descriptive User-Agent with a contact email
(set SEC_USER_AGENT) and to stay under 10 requests/second.
"""
import logging
import re
import time
from datetime import date
from html.parser import HTMLParser
from typing import Optional
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.repositories.evidence_repository import get_latest_evidence, save_evidence_item

logger = logging.getLogger("wealth-copilot.sec")

SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
SEC_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
SEC_ARCHIVE_URL = "https://www.sec.gov/Archives/edgar/data/{cik_int}/{accn}/{doc}"
SEC_FILING_INDEX_URL = "https://www.sec.gov/Archives/edgar/data/{cik_int}/{accn}/"

FINANCIALS_FRESHNESS_SECONDS = 24 * 3600
YEARS = 3

# Metric -> XBRL us-gaap concepts in priority order (companies switch tags over time)
METRICS = {
    "revenue": ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet",
                "RevenueFromContractWithCustomerIncludingAssessedTax"],
    "gross_profit": ["GrossProfit"],
    "operating_income": ["OperatingIncomeLoss"],
    "net_income": ["NetIncomeLoss", "ProfitLoss"],
    "eps_diluted": ["EarningsPerShareDiluted"],
    "operating_cash_flow": ["NetCashProvidedByUsedInOperatingActivities"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment"],
    "cash": ["CashAndCashEquivalentsAtCarryingValue",
             "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
    "total_assets": ["Assets"],
    "total_liabilities": ["Liabilities"],
    "long_term_debt": ["LongTermDebtNoncurrent", "LongTermDebt"],
    "shareholders_equity": ["StockholdersEquity"],
}
# Balance-sheet items are point-in-time ("instant"); the rest cover a period
INSTANT_METRICS = {"cash", "total_assets", "total_liabilities", "long_term_debt", "shareholders_equity"}

_ticker_map: dict = {}
_ticker_map_loaded_at = 0.0
_sections_cache: dict = {}  # accession -> {"risk_factors": str, "mdna": str}


class SECError(Exception):
    pass


def _headers() -> dict:
    return {"User-Agent": settings.SEC_USER_AGENT, "Accept-Encoding": "gzip, deflate"}


def _get(url: str, timeout: float = 20.0) -> httpx.Response:
    response = httpx.get(url, headers=_headers(), timeout=timeout, follow_redirects=True)
    if response.status_code == 403:
        raise SECError("SEC rejected the request -- set SEC_USER_AGENT to 'AppName your@email.com'")
    if response.status_code == 404:
        raise SECError(f"Not found on SEC EDGAR: {url}")
    response.raise_for_status()
    return response


# ── Ticker -> CIK ────────────────────────────────────────────────────────────

def lookup_cik(ticker: str) -> Optional[str]:
    """Returns the 10-digit CIK for a ticker, or None if it isn't an SEC registrant."""
    global _ticker_map, _ticker_map_loaded_at
    if not _ticker_map or time.time() - _ticker_map_loaded_at > 24 * 3600:
        data = _get(SEC_TICKERS_URL).json()
        _ticker_map = {row["ticker"].upper(): str(row["cik_str"]).zfill(10) for row in data.values()}
        _ticker_map_loaded_at = time.time()
    t = ticker.upper()
    # SEC writes class shares with a dash (BRK-B); users often type a dot (BRK.B)
    return _ticker_map.get(t) or _ticker_map.get(t.replace(".", "-"))


# ── Financial facts ──────────────────────────────────────────────────────────

def _days(start: str, end: str) -> int:
    return (date.fromisoformat(end) - date.fromisoformat(start)).days


def _annual_values(concept_data: dict, instant: bool) -> list[dict]:
    """Full-fiscal-year values reported in 10-K filings, one per period end (latest filing wins)."""
    by_end: dict = {}
    for unit_values in concept_data.get("units", {}).values():
        for v in unit_values:
            if v.get("form") not in ("10-K", "10-K/A") or v.get("fp") != "FY":
                continue
            if not instant:
                if not v.get("start") or not 350 <= _days(v["start"], v["end"]) <= 380:
                    continue  # skip quarterly figures that 10-Ks also contain
            prev = by_end.get(v["end"])
            if prev is None or v.get("filed", "") > prev.get("filed", ""):
                by_end[v["end"]] = v
    return [by_end[e] for e in sorted(by_end)]


def extract_annual_financials(facts: dict, years: int = YEARS) -> dict:
    """Picks the last `years` fiscal years for each headline metric from a companyfacts payload."""
    gaap = facts.get("facts", {}).get("us-gaap", {})
    metrics = {}
    for name, concepts in METRICS.items():
        best: list = []
        for concept in concepts:
            if concept not in gaap:
                continue
            values = _annual_values(gaap[concept], instant=name in INSTANT_METRICS)
            # Prefer whichever tag has the most recent data
            if values and (not best or values[-1]["end"] > best[-1]["end"]):
                best = values
        if best:
            metrics[name] = [
                {"end": v["end"], "value": v["val"], "accession": v.get("accn"), "filed": v.get("filed")}
                for v in best[-years:]
            ]

    # Drop series a company stopped reporting (e.g. a tag last used in 2013),
    # so old figures are never presented alongside current ones
    if metrics:
        latest = max(date.fromisoformat(s[-1]["end"]) for s in metrics.values())
        metrics = {
            k: s for k, s in metrics.items()
            if (latest - date.fromisoformat(s[-1]["end"])).days <= 400
        }
    return metrics


def _latest_filings(submissions: dict, cik: str) -> dict:
    recent = submissions.get("filings", {}).get("recent", {})
    found = {}
    for i, form in enumerate(recent.get("form", [])):
        if form in ("10-K", "10-Q") and form not in found:
            accn = recent["accessionNumber"][i]
            found[form] = {
                "form": form,
                "accession": accn,
                "filing_date": recent["filingDate"][i],
                "report_date": recent["reportDate"][i],
                "primary_document": recent["primaryDocument"][i],
                "url": SEC_ARCHIVE_URL.format(cik_int=int(cik), accn=accn.replace("-", ""),
                                              doc=recent["primaryDocument"][i]),
            }
        if len(found) == 2:
            break
    return found


def get_company_financials(ticker: str, db: Session) -> Optional[dict]:
    """
    Official annual financials + latest 10-K/10-Q references for a ticker.
    Cached in evidence_items for 24h. Returns None for non-SEC companies.
    """
    ticker = ticker.upper()
    cached = get_latest_evidence(db, ticker, "sec_financials")
    if cached and cached.retrieved_at and time.time() - cached.retrieved_at.timestamp() < FINANCIALS_FRESHNESS_SECONDS:
        return cached.payload or None

    cik = lookup_cik(ticker)
    if not cik:
        return None

    submissions = _get(SEC_SUBMISSIONS_URL.format(cik=cik)).json()
    facts = _get(SEC_FACTS_URL.format(cik=cik), timeout=30.0).json()

    result = {
        "ticker": ticker,
        "cik": cik,
        "company": submissions.get("name") or facts.get("entityName") or ticker,
        "metrics": extract_annual_financials(facts),
        "filings": _latest_filings(submissions, cik),
    }
    save_evidence_item(db=db, ticker=ticker, source_type="sec_financials", payload=result, reliability_weight=1.0)
    return result


# ── Filing text (10-K Item 1A / Item 7) ──────────────────────────────────────

class _TextExtractor(HTMLParser):
    """HTML -> plain text, keeping block boundaries and skipping hidden XBRL headers."""
    BLOCK = {"p", "div", "br", "tr", "li", "h1", "h2", "h3", "h4", "h5", "h6", "table", "section"}
    SKIP = {"script", "style", "ix:header", "head"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip_depth += 1
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self.skip_depth = max(0, self.skip_depth - 1)
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.skip_depth:
            self.parts.append(data)


def html_to_text(html: str) -> str:
    parser = _TextExtractor()
    parser.feed(html)
    text = "".join(parser.parts).replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    return "\n".join(line for line in lines if line)


_SECTION_PATTERNS = {
    "risk_factors": (r"item\s*1a\s*[.:\-–—]?\s*risk\s+factors",
                     r"item\s*1b\s*[.:\-–—]?\s*unresolved|item\s*1c\s*[.:\-–—]?\s*cybersecurity|item\s*2\s*[.:\-–—]?\s*properties"),
    "mdna": (r"item\s*7\s*[.:\-–—]?\s*management.{0,5}s\s+discussion"
             r"(?:\s+and\s+analysis(?:\s+of\s+financial\s+condition\s+and\s+results\s+of\s+operations)?)?",
             r"item\s*7a\s*[.:\-–—]?\s*quantitative|item\s*8\s*[.:\-–—]?\s*financial\s+statements"),
}


def extract_sections(text: str, max_chars: int = 150_000) -> dict:
    """
    Finds 10-K sections by their "Item" headings. The table of contents repeats
    every heading, so the longest start->end span is taken as the real section.
    """
    sections = {}
    for name, (start_pat, end_pat) in _SECTION_PATTERNS.items():
        starts = [m.end() for m in re.finditer(start_pat, text, re.IGNORECASE)]
        ends = [m.start() for m in re.finditer(end_pat, text, re.IGNORECASE)]
        best = ""
        for s in starts:
            e = next((e for e in ends if e > s), None)
            if e is not None and e - s > len(best):
                best = text[s:e]
        if best:
            sections[name] = best.strip()[:max_chars]
    return sections


def get_10k_sections(filing: dict) -> dict:
    """Fetches the 10-K document and returns its Risk Factors and MD&A text (cached per filing)."""
    accn = filing["accession"]
    if accn not in _sections_cache:
        html = _get(filing["url"], timeout=40.0).text
        _sections_cache[accn] = extract_sections(html_to_text(html))
        if len(_sections_cache) > 50:
            _sections_cache.pop(next(iter(_sections_cache)))
    return _sections_cache[accn]


_STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "it", "its", "my", "i", "me",
    "should", "would", "could", "can", "do", "does", "how", "what", "why", "when", "which", "buy", "sell",
    "hold", "more", "stock", "shares", "share", "position", "now", "good", "right", "time", "about", "this",
    "that", "be", "with", "at", "from", "by", "as", "you", "your", "we", "our", "will", "much", "too", "large",
}


def relevant_passages(section_text: str, query: str, limit: int = 3, max_chars: int = 600) -> list[str]:
    """
    Picks the paragraphs of a filing section most relevant to the question
    (keyword overlap). Falls back to the opening paragraphs for generic questions.
    """
    paragraphs = [p.strip() for p in section_text.split("\n") if len(p.strip()) >= 120]
    if not paragraphs:
        return []
    terms = {w for w in re.findall(r"[a-z]{3,}", query.lower()) if w not in _STOPWORDS}

    if terms:
        scored = []
        for i, p in enumerate(paragraphs):
            lower = p.lower()
            score = sum(lower.count(t) for t in terms)
            if score:
                scored.append((score, i, p))
        scored.sort(key=lambda x: (-x[0], x[1]))
        chosen = [p for _, _, p in scored[:limit]]
    else:
        chosen = []
    if not chosen:
        chosen = paragraphs[:limit]
    return [p if len(p) <= max_chars else p[:max_chars].rsplit(" ", 1)[0] + "…" for p in chosen]


# ── Formatting for prompts ───────────────────────────────────────────────────

def _fmt_money(v: float) -> str:
    sign = "-" if v < 0 else ""
    v = abs(v)
    if v >= 1e9:
        return f"{sign}${v / 1e9:,.1f}B"
    if v >= 1e6:
        return f"{sign}${v / 1e6:,.1f}M"
    return f"{sign}${v:,.0f}"


def financial_highlights(fin: dict) -> dict:
    """Derived ratios from the latest fiscal year, for compact use (e.g. strategy agent)."""
    m = fin.get("metrics", {})
    out = {}
    rev = m.get("revenue", [])
    ni = m.get("net_income", [])
    if rev:
        out["fiscal_year_end"] = rev[-1]["end"]
        out["revenue"] = rev[-1]["value"]
        if len(rev) >= 2 and rev[-2]["value"]:
            out["revenue_growth_pct"] = round((rev[-1]["value"] - rev[-2]["value"]) / abs(rev[-2]["value"]) * 100, 1)
    if rev and ni and ni[-1]["end"] == rev[-1]["end"] and rev[-1]["value"]:
        out["net_margin_pct"] = round(ni[-1]["value"] / rev[-1]["value"] * 100, 1)
    return out


def format_financials_for_prompt(fin: dict) -> str:
    """Renders the financials as a cited table the LLM can quote."""
    m = fin.get("metrics", {})
    k = fin.get("filings", {}).get("10-K")
    citation = f"{fin['ticker']} 10-K filed {k['filing_date']}" if k else f"{fin['ticker']} SEC filings"
    lines = [f"Official SEC financials for {fin['company']} (source: {citation}, XBRL data):"]
    labels = {
        "revenue": "Revenue", "gross_profit": "Gross profit", "operating_income": "Operating income",
        "net_income": "Net income", "eps_diluted": "Diluted EPS", "operating_cash_flow": "Operating cash flow",
        "capex": "Capital expenditure", "cash": "Cash & equivalents", "total_assets": "Total assets",
        "total_liabilities": "Total liabilities", "long_term_debt": "Long-term debt",
        "shareholders_equity": "Shareholders' equity",
    }
    for key, label in labels.items():
        series = m.get(key)
        if not series:
            continue
        if key == "eps_diluted":
            vals = ", ".join(f"FY{v['end'][:4]}: ${v['value']:.2f}" for v in series)
        else:
            vals = ", ".join(f"FY{v['end'][:4]}: {_fmt_money(v['value'])}" for v in series)
        lines.append(f"- {label}: {vals}")
    h = financial_highlights(fin)
    if "revenue_growth_pct" in h:
        lines.append(f"- Revenue growth (latest FY): {h['revenue_growth_pct']:+.1f}%")
    if "net_margin_pct" in h:
        lines.append(f"- Net margin (latest FY): {h['net_margin_pct']:.1f}%")
    return "\n".join(lines)


def build_sources(fin: dict) -> list[dict]:
    """Links to the filings used, for display alongside the answer."""
    sources = []
    for form in ("10-K", "10-Q"):
        f = fin.get("filings", {}).get(form)
        if f:
            sources.append({
                "label": f"{fin['ticker']} {form} (period ending {f['report_date']}, filed {f['filing_date']})",
                "url": f["url"],
            })
    return sources


def gather_sec_evidence(ticker: str, query: str, db: Session) -> Optional[dict]:
    """
    Everything the evidence agent needs from EDGAR for one ticker:
    {"financials_text", "passages": [{"citation", "text"}], "sources", "highlights"}.
    Returns None if the company isn't an SEC registrant or EDGAR is unavailable.
    """
    try:
        fin = get_company_financials(ticker, db)
    except Exception as e:
        logger.warning("SEC financials unavailable for %s: %s", ticker, e)
        return None
    if not fin or not fin.get("metrics"):
        return None

    passages = []
    k = fin.get("filings", {}).get("10-K")
    if k:
        try:
            sections = get_10k_sections(k)
            fy = k["report_date"][:4]
            for key, item in (("risk_factors", "Item 1A Risk Factors"), ("mdna", "Item 7 MD&A")):
                if sections.get(key):
                    for text in relevant_passages(sections[key], query, limit=2):
                        passages.append({"citation": f"{fin['ticker']} 10-K FY{fy}, {item}", "text": text})
        except Exception as e:
            logger.warning("Could not read 10-K text for %s: %s", ticker, e)

    return {
        "company": fin.get("company"),
        "financials_text": format_financials_for_prompt(fin),
        "passages": passages,
        "sources": build_sources(fin),
        "highlights": financial_highlights(fin),
    }

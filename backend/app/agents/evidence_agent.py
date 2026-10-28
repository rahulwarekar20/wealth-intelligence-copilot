"""
Evidence Agent: gathers market data, news, SEC filings and the user's own
documents for one ticker, then asks the LLM for supporting and contradicting
points, each with a citation.
"""

import re
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session, sessionmaker
from app.agents.llm_client import invoke_llm_json
from app.services.evidence_service import gather_evidence
from app.services.document_service import find_relevant_excerpts
from app.services.sec_service import gather_sec_evidence

_COMPANY_SUFFIX = re.compile(r"[\s,]+(inc|corp|corporation|co|ltd|plc|holdings|group|company)\.?$", re.IGNORECASE)


def analyze_evidence(ticker: str, query: str, db: Session, user_id: str = "") -> dict:
    """
    Evidence Agent -- gathers and reasons over all available evidence for a
    ticker: market data, news, official SEC filings (10-K financials, Risk
    Factors, MD&A) and the user's uploaded documents.

    Returns structured evidence analysis with supporting and contradicting
    signals, each carrying a citation, plus the list of sources used.
    """
    # Finnhub (market data, news, profile) and SEC EDGAR (official figures and
    # filing text; None for ETFs / non-US issuers) are fetched in parallel,
    # the SEC side on its own DB session since sessions aren't thread-safe
    def fetch_sec():
        """Fetches SEC evidence on its own DB session, so it can run in a separate thread."""
        if db is None:
            return gather_sec_evidence(ticker, query, db)
        sec_db = sessionmaker(bind=db.get_bind(), autocommit=False, autoflush=False)()
        try:
            return gather_sec_evidence(ticker, query, sec_db)
        finally:
            sec_db.close()

    with ThreadPoolExecutor(max_workers=1) as executor:
        sec_future = executor.submit(fetch_sec)
        evidence = gather_evidence(ticker, db)
        sec = sec_future.result()

    price_data = evidence.get("price_data", {})
    news = evidence.get("news_sentiment", {})
    fundamentals = evidence.get("fundamentals", {})

    # Excerpts from the user's own documents that mention this company
    company = fundamentals.get("company_name") or ""
    terms = [ticker, company, _COMPANY_SUFFIX.sub("", company)]
    try:
        doc_excerpts = find_relevant_excerpts(db, user_id, terms)
    except Exception:
        doc_excerpts = []

    evidence_context = f"""
Price Data (market data feed):
- Current Price: ${price_data.get('current_price') or 0:.2f}
- Daily Change: {price_data.get('daily_change_pct') or 0:.2f}%
- Trend: {price_data.get('trend', 'unknown')}
- 52-Week High: {fundamentals.get('52_week_high', 'N/A')}
- 52-Week Low: {fundamentals.get('52_week_low', 'N/A')}

Company Profile (market data feed):
- Company: {fundamentals.get('company_name', ticker)}
- Industry: {fundamentals.get('industry', 'Unknown')}
- Market Cap: ${fundamentals.get('market_cap') or 0:,.0f}M
- P/E Ratio: {fundamentals.get('pe_ratio', 'N/A')}

News Sentiment:
- Total Headlines: {news.get('headline_count', 0)}
- Overall Sentiment: {news.get('sentiment', 'neutral')}
- Sentiment Score: {news.get('sentiment_score', 0)}
- Recent Headlines:
"""
    for h in news.get("headlines", [])[:3]:
        evidence_context += f"  * {h.get('headline', '')}\n"

    if sec:
        evidence_context += f"\n{sec['financials_text']}\n"
        if sec["passages"]:
            evidence_context += "\nExcerpts from the latest 10-K (quote with the citation shown in brackets):\n"
            for p in sec["passages"]:
                evidence_context += f"  * [{p['citation']}] {p['text']}\n"
    else:
        evidence_context += "\nNo SEC filings available for this ticker (e.g. an ETF or non-US company).\n"

    if doc_excerpts:
        evidence_context += "\nUser-Uploaded Documents:\n"
        for d in doc_excerpts:
            evidence_context += f"  * [{d['document']}] ...{d['excerpt']}...\n"

    system_prompt = """You are the Evidence Agent for a wealth intelligence platform.
Your job is to analyze all available evidence for a stock and identify
what SUPPORTS and what CONTRADICTS a positive investment view.

Rules:
- Prefer the official SEC financials and 10-K excerpts over other sources when they are available.
- Quote actual figures (e.g. "revenue grew 6.4% to $416.2B in FY2025").
- Every signal MUST have a citation naming where it came from, e.g.
  "AAPL 10-K FY2025, Item 1A Risk Factors", "AAPL 10-K FY2025 financials", "market data", "news headlines",
  or the uploaded document's file name.
- Do NOT make up data that is not provided. If evidence is insufficient, say so explicitly.
- Be concise: at most 4 signals per side, each signal at most 20 words.

Respond in this exact JSON format:
{
  "evidence_for": [
    {"signal": "description of positive signal", "source": "sec_filing|price_volume|sentiment|document", "citation": "where it came from", "strength": "strong|moderate|weak"}
  ],
  "evidence_against": [
    {"signal": "description of negative signal", "source": "sec_filing|price_volume|sentiment|document", "citation": "where it came from", "strength": "strong|moderate|weak"}
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

    # Sources are attached deterministically so the UI can link to the real filings
    sources = list(sec["sources"]) if sec else []
    sources += [{"label": f"Uploaded document: {name}", "url": None}
                for name in sorted({d["document"] for d in doc_excerpts})]

    # The underlying data is kept even if the LLM step fails, so key figures,
    # sources and the SEC numbers still reach the composer and the UI
    raw_evidence = {
        "price": price_data,
        "fundamentals": fundamentals,
        "sentiment": news.get("sentiment"),
        "sentiment_score": news.get("sentiment_score"),
        "headline_count": news.get("headline_count"),
        "sec_highlights": sec["highlights"] if sec else None,
        "sec_financials_text": sec["financials_text"] if sec else None,
        "company": (sec or {}).get("company") or fundamentals.get("company_name"),
        "documents_used": sorted({d["document"] for d in doc_excerpts}),
        # Exactly which 10-K sections were retrieved, so citations can be verified later
        "passage_citations": [p["citation"] for p in sec["passages"]] if sec else [],
    }

    try:
        result = invoke_llm_json(system_prompt, user_prompt, max_tokens=1000, use_small_model=True)
        result["sources"] = sources
        result["raw_evidence"] = raw_evidence
        return result
    except Exception as e:
        return {
            "evidence_for": [],
            "evidence_against": [],
            "overall_evidence_tone": "neutral",
            "key_risk": None,
            "key_opportunity": None,
            "evidence_quality": "low",
            "sources": sources,
            "raw_evidence": raw_evidence,
            "error": str(e)
        }

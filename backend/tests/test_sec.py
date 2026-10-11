"""SEC EDGAR parsing tests -- no network calls."""
from app.services import sec_service as sec


def _fact(start, end, val, form="10-K", fp="FY", filed="2025-01-01", accn="0001"):
    v = {"end": end, "val": val, "form": form, "fp": fp, "filed": filed, "accn": accn}
    if start:
        v["start"] = start
    return v


FACTS = {
    "facts": {"us-gaap": {
        # Old tag, abandoned years ago
        "SalesRevenueNet": {"units": {"USD": [_fact("2011-01-01", "2011-12-31", 50)]}},
        "RevenueFromContractWithCustomerExcludingAssessedTax": {"units": {"USD": [
            _fact("2022-01-01", "2022-12-31", 100),
            _fact("2023-01-01", "2023-12-31", 110),
            _fact("2023-10-01", "2023-12-31", 30),            # Q4 figure inside a 10-K -> ignored
            _fact("2024-01-01", "2024-12-31", 121, filed="2025-02-01"),
            _fact("2024-01-01", "2024-12-31", 120, form="10-Q", fp="Q4"),  # not a 10-K -> ignored
        ]}},
        "NetIncomeLoss": {"units": {"USD": [_fact("2024-01-01", "2024-12-31", 24)]}},
        "Assets": {"units": {"USD": [_fact(None, "2024-12-31", 500)]}},
        "LongTermDebt": {"units": {"USD": [_fact(None, "2013-12-31", 999)]}},  # stale -> dropped
    }}
}


def test_annual_financials_pick_full_years_from_10k():
    """S1 - Only full fiscal years from 10-Ks, latest tag wins, last 3 years"""
    m = sec.extract_annual_financials(FACTS)
    assert [v["value"] for v in m["revenue"]] == [100, 110, 121]
    assert m["total_assets"][0]["value"] == 500


def test_stale_series_dropped():
    """S2 - A tag last reported in 2013 is not shown next to 2024 figures"""
    assert "long_term_debt" not in sec.extract_annual_financials(FACTS)


def test_highlights_and_prompt_text():
    """S3 - Growth and margin derived; prompt text carries the citation"""
    fin = {"ticker": "TEST", "company": "Test Corp", "metrics": sec.extract_annual_financials(FACTS),
           "filings": {"10-K": {"filing_date": "2025-02-01", "report_date": "2024-12-31", "url": "u"}}}
    h = sec.financial_highlights(fin)
    assert h["revenue_growth_pct"] == 10.0
    assert h["net_margin_pct"] == 19.8
    text = sec.format_financials_for_prompt(fin)
    assert "TEST 10-K filed 2025-02-01" in text and "Revenue" in text


def test_html_to_text_skips_hidden_xbrl():
    """S4 - Hidden inline-XBRL header content is not treated as filing text"""
    html = "<html><body><ix:header>us-gaap:Junk 12345</ix:header><p>Real&nbsp;text</p><div>More</div></body></html>"
    assert sec.html_to_text(html) == "Real text\nMore"


def test_extract_sections_ignores_table_of_contents():
    """S5 - The real section is used, not the table-of-contents entry"""
    body = "x" * 200
    text = (
        "Item 1A. Risk Factors 10\nItem 1B. Unresolved Staff Comments 20\n"
        "Item 7. Management's Discussion and Analysis 30\nItem 7A. Quantitative 40\n"
        f"Item 1A. Risk Factors\nSupply chain risk. {body}\nItem 1B. Unresolved Staff Comments\nNone.\n"
        f"Item 7. Management’s Discussion and Analysis\nRevenue grew. {body}\nItem 7A. Quantitative and Qualitative\n"
    )
    s = sec.extract_sections(text)
    assert s["risk_factors"].startswith("Supply chain risk.")
    assert s["mdna"].startswith("Revenue grew.")


def test_relevant_passages_prefers_question_terms():
    """S6 - Paragraphs matching the question are chosen first"""
    filler = " This sentence pads the paragraph to a realistic length for a filing."
    paras = [
        "General statement about the business and its many products sold across the world." + filler,
        "Tariffs on imports from China could raise costs materially; China is a key market." + filler,
        "Another general paragraph about competition in the industry and pricing pressure." + filler,
    ]
    out = sec.relevant_passages("\n".join(paras), "What are the China tariff risks?", limit=1)
    assert out == [paras[1]]
    # Generic question -> opening paragraphs
    assert sec.relevant_passages("\n".join(paras), "Should I buy?", limit=1) == [paras[0]]


def test_brk_dot_ticker_maps_to_dash(monkeypatch):
    """S7 - BRK.B is looked up as SEC's BRK-B"""
    monkeypatch.setattr(sec, "_ticker_map", {"BRK-B": "0001067983"})
    monkeypatch.setattr(sec, "_ticker_map_loaded_at", 10**12)
    assert sec.lookup_cik("brk.b") == "0001067983"
    assert sec.lookup_cik("SPYX") is None

"""
Holdings import: CSV column detection across broker formats, row cleaning,
the AI fallback for PDFs and unknown layouts, and the preview → confirm API.
The LLM is mocked — no network.
"""
from app.services import import_service

FIDELITY_STYLE = """Brokerage positions as of 10/18/2026
Account: Individual - TOD

Account Name,Symbol,Description,Quantity,Last Price,Current Value,Average Cost Basis
Individual,AAPL,APPLE INC,10,$231.40,"$2,314.00",$150.25
ROTH IRA,MSFT,MICROSOFT CORP,"1,200",$428.10,"$513,720.00",$310.00
Individual,SPAXX**,HELD IN MONEY MARKET,,,$1000.00,
Individual,Pending Activity,,,,$12.00,
Totals,,,,,"$517,046.00",
"""

TOTAL_COST_STYLE = """Ticker,Shares,Cost Basis,Account Type
googl,4,480,401(k) Plan
JPM,2.5,,Traditional IRA
"""


def test_csv_detects_columns_after_title_lines():
    """T101 - Header row is found below a broker's title lines; cash, pending and totals are skipped"""
    rows = import_service.parse_csv(FIDELITY_STYLE)
    assert rows == [
        {"ticker": "AAPL", "quantity": 10.0, "cost_basis": 150.25, "account_type": "taxable"},
        {"ticker": "MSFT", "quantity": 1200.0, "cost_basis": 310.0, "account_type": "roth_ira"},
    ]


def test_csv_total_cost_is_converted_to_per_share():
    """T102 - A total cost basis is divided by the share count; tickers are upper-cased"""
    rows = import_service.parse_csv(TOTAL_COST_STYLE)
    assert rows[0] == {"ticker": "GOOGL", "quantity": 4.0, "cost_basis": 120.0, "account_type": "401k"}
    assert rows[1] == {"ticker": "JPM", "quantity": 2.5, "cost_basis": None, "account_type": "ira"}


def test_csv_without_recognisable_columns_returns_none():
    """T103 - Unknown layouts are handed to the AI fallback"""
    assert import_service.parse_csv("Name,Value\nApple,100\n") is None


def test_account_normalisation():
    """T104 - Broker account labels map to the app's account types"""
    assert import_service.normalise_account("Roth IRA") == "roth_ira"
    assert import_service.normalise_account("Rollover IRA") == "ira"
    assert import_service.normalise_account("401(k)") == "401k"
    assert import_service.normalise_account("Joint WROS") == "taxable"
    assert import_service.normalise_account(None) == "taxable"


def test_ai_fallback_rows_are_validated(monkeypatch):
    """T105 - Rows the AI extracts are cleaned like CSV rows; junk is dropped"""
    monkeypatch.setattr(import_service, "invoke_llm_json", lambda *a, **k: {"holdings": [
        {"ticker": "aapl", "quantity": "10", "cost_per_share": "$150", "account": "Individual"},
        {"ticker": "Cash", "quantity": 500},
        {"ticker": "MSFT", "quantity": 0},
        "not a dict",
    ]})
    assert import_service.extract_with_ai("statement text") == [
        {"ticker": "AAPL", "quantity": 10.0, "cost_basis": 150.0, "account_type": "taxable"},
    ]


def _upload(client, name, content, mime="text/csv"):
    return client.post("/portfolio/import/preview", files={"file": (name, content.encode(), mime)})


def test_preview_does_not_save(auth_client):
    """T106 - The preview returns rows but saves nothing"""
    r = _upload(auth_client, "positions.csv", FIDELITY_STYLE)
    assert r.status_code == 200
    assert r.json()["method"] == "csv"
    assert len(r.json()["holdings"]) == 2
    assert auth_client.get("/portfolio/holdings").json() == []


def test_preview_falls_back_to_ai_for_unknown_csv(auth_client, monkeypatch):
    """T107 - A CSV the parser can't read is sent to the AI"""
    monkeypatch.setattr(import_service, "invoke_llm_json",
                        lambda *a, **k: {"holdings": [{"ticker": "SPY", "quantity": 3}]})
    r = _upload(auth_client, "odd.csv", "Name,Value\nS&P 500 ETF,3 units\n")
    assert r.json() == {"holdings": [{"ticker": "SPY", "quantity": 3.0, "cost_basis": None, "account_type": "taxable"}],
                        "method": "ai"}


def test_preview_errors(auth_client, monkeypatch):
    """T108 - Unsupported, empty and holding-less files get clear 400 errors"""
    assert _upload(auth_client, "image.png", "x", "image/png").status_code == 400
    assert _upload(auth_client, "empty.csv", "").status_code == 400
    monkeypatch.setattr(import_service, "invoke_llm_json", lambda *a, **k: {"holdings": []})
    r = _upload(auth_client, "notes.csv", "Name,Value\nnothing,here\n")
    assert r.status_code == 400
    assert "No holdings found" in r.json()["detail"]


def test_confirm_adds_or_replaces(auth_client):
    """T109 - Confirming adds the rows; replace=true swaps out the existing holdings"""
    auth_client.post("/portfolio/holdings", json={"ticker": "OLD", "quantity": 1})
    rows = [{"ticker": "AAPL", "quantity": 10, "cost_basis": 150, "account_type": "taxable"}]

    assert auth_client.post("/portfolio/import", json={"holdings": rows}).json() == {"imported": 1, "replaced": False}
    assert sorted(h["ticker"] for h in auth_client.get("/portfolio/holdings").json()) == ["AAPL", "OLD"]

    auth_client.post("/portfolio/import", json={"holdings": rows, "replace": True})
    assert [h["ticker"] for h in auth_client.get("/portfolio/holdings").json()] == ["AAPL"]


def test_confirm_validates_rows(auth_client):
    """T110 - Invalid rows are rejected and nothing is saved"""
    bad = [{"ticker": "AAPL", "quantity": -1}]
    assert auth_client.post("/portfolio/import", json={"holdings": bad}).status_code == 422
    assert auth_client.post("/portfolio/import", json={"holdings": []}).status_code == 422
    assert auth_client.get("/portfolio/holdings").json() == []

"""
Import holdings from a brokerage export.

- CSV files are parsed directly: column names vary by broker, so common
  aliases are recognised (Symbol/Ticker, Quantity/Shares, Average cost, ...).
- PDF statements, and CSVs whose columns can't be recognised, are read by the
  LLM, which extracts the holdings as JSON.

Nothing is saved here: parse_holdings_file() returns a preview, which the user
confirms before the API creates the holdings.
"""
import csv
import io
import logging
import re
from typing import Optional

from app.agents.llm_client import invoke_llm_json
from app.services.document_service import detect_kind, extract_text

logger = logging.getLogger("wealth-copilot.import")

MAX_ROWS = 200
# Statement text sent to the LLM (enough for a few pages of positions)
MAX_AI_CHARS = 30_000

_TICKER = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")
# Rows brokers include that are not holdings
_NOT_HOLDINGS = {"CASH", "TOTAL", "TOTALS", "PENDING", "ACCOUNT", "SPAXX", "FCASH", "CORE"}

# Lower-cased header -> field. Matched exactly first, then by "contains".
_ALIASES = {
    "ticker": ["symbol", "ticker", "ticker symbol", "security symbol", "stock symbol"],
    "quantity": ["quantity", "qty", "shares", "units", "share quantity"],
    "cost_per_share": ["average cost", "avg cost", "average cost basis", "cost per share", "cost/share",
                       "cost basis per share", "per share",
                       "unit cost", "avg price", "average price", "purchase price", "price paid"],
    "cost_total": ["cost basis", "total cost", "cost basis total", "book value"],
    "account": ["account", "account type", "account name"],
}


def _number(value) -> Optional[float]:
    """Parses '$1,234.50', '(12.00)' or '1 234' style numbers; None if not a number."""
    if value is None:
        return None
    text = str(value).strip()
    negative = text.startswith("(") and text.endswith(")")
    text = re.sub(r"[^0-9.\-]", "", text)
    try:
        number = float(text)
    except ValueError:
        return None
    return -number if negative else number


def normalise_account(value: Optional[str]) -> str:
    """Maps a broker's account label to taxable / ira / roth_ira / 401k."""
    label = (value or "").lower()
    if "roth" in label:
        return "roth_ira"
    if "401" in label:
        return "401k"
    if "ira" in label:
        return "ira"
    return "taxable"


def _clean_row(ticker, quantity, cost_per_share=None, cost_total=None, account=None) -> Optional[dict]:
    """A validated holding row, or None if the row is not a stock position."""
    parts = str(ticker or "").upper().replace("$", "").split()
    ticker = parts[0] if parts else ""
    qty = _number(quantity)
    if not ticker or ticker in _NOT_HOLDINGS or not _TICKER.match(ticker) or not qty or qty <= 0:
        return None
    cost = _number(cost_per_share)
    if cost is None and cost_total is not None and _number(cost_total):
        cost = _number(cost_total) / qty
    return {
        "ticker": ticker,
        "quantity": round(qty, 6),
        "cost_basis": round(cost, 4) if cost and cost > 0 else None,
        "account_type": normalise_account(account),
    }


def _find_columns(headers: list[str]) -> dict:
    """Field -> column index for the recognised headers."""
    lowered = [h.strip().lower() for h in headers]
    found = {}
    for field, aliases in _ALIASES.items():
        for i, h in enumerate(lowered):  # exact match first
            if h in aliases:
                found[field] = i
                break
        else:
            for i, h in enumerate(lowered):
                if any(a in h for a in aliases) and i not in found.values():
                    found[field] = i
                    break
    return found


def parse_csv(text: str) -> Optional[list[dict]]:
    """
    Holdings from CSV text, or None if no header row with ticker and quantity
    columns can be found (the caller then falls back to the LLM).
    Broker exports often start with a few title lines, so the header row is
    searched for in the first 15 lines.
    """
    rows = list(csv.reader(io.StringIO(text)))
    for header_index, header in enumerate(rows[:15]):
        cols = _find_columns(header)
        if "ticker" in cols and "quantity" in cols:
            break
    else:
        return None

    def cell(row, field):
        """The value of `field` in this row, or None if the column is missing."""
        i = cols.get(field)
        return row[i] if i is not None and i < len(row) else None

    holdings = []
    for row in rows[header_index + 1:]:
        clean = _clean_row(cell(row, "ticker"), cell(row, "quantity"), cell(row, "cost_per_share"),
                           cell(row, "cost_total"), cell(row, "account"))
        if clean:
            holdings.append(clean)
    return holdings[:MAX_ROWS]


def extract_with_ai(text: str) -> list[dict]:
    """Holdings read from statement text by the LLM, validated like CSV rows."""
    system_prompt = """You extract stock and ETF holdings from brokerage statements.
Return every position with its ticker symbol, number of shares, cost per share
(null if not shown; if only a total cost is shown, divide it by the shares) and
the account it is held in (e.g. "Individual", "Roth IRA", "401(k)").
Ignore cash, money-market sweep funds, totals and transactions.

Respond with JSON only:
{"holdings": [{"ticker": "AAPL", "quantity": 10, "cost_per_share": 150.25, "account": "Individual"}]}"""
    result = invoke_llm_json(system_prompt, f"Statement text:\n\n{text[:MAX_AI_CHARS]}", max_tokens=2000)
    holdings = []
    for h in result.get("holdings") or []:
        if isinstance(h, dict):
            clean = _clean_row(h.get("ticker"), h.get("quantity"), h.get("cost_per_share"), None, h.get("account"))
            if clean:
                holdings.append(clean)
    return holdings[:MAX_ROWS]


def parse_holdings_file(filename: str, content_type: Optional[str], data: bytes) -> dict:
    """
    Preview of the holdings in an uploaded file: {"holdings": [...], "method": "csv" | "ai"}.
    Raises DocumentError for unsupported or unreadable files, ValueError if
    no holdings could be found.
    """
    ext = detect_kind(filename, content_type)
    text = extract_text(data, ext)

    holdings, method = None, "csv"
    if ext in (".csv", ".txt"):
        holdings = parse_csv(text)
    if not holdings:
        method = "ai"
        holdings = extract_with_ai(text)
    if not holdings:
        raise ValueError("No holdings found in this file. Check it is a positions or holdings export.")
    return {"holdings": holdings, "method": method}

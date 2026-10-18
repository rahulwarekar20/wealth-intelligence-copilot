"""
Schema consistency: db/init.sql (used to create the database) and the
SQLAlchemy models in app/models/models.py (used by the app and the tests)
must define the same tables and columns. If one changes without the other,
production breaks while tests still pass — this test catches that.
"""
import re
from pathlib import Path

from app.core.db import Base
from app.models import models  # noqa: F401 -- registers the models on Base

INIT_SQL = Path(__file__).resolve().parents[2] / "db" / "init.sql"

_CREATE_TABLE = re.compile(r"CREATE TABLE\s+(\w+)\s*\((.*?)\);", re.IGNORECASE | re.DOTALL)
_NOT_A_COLUMN = {"PRIMARY", "FOREIGN", "UNIQUE", "CONSTRAINT", "CHECK"}


def _strip_comments(sql: str) -> str:
    return re.sub(r"--[^\n]*", "", sql)


def _split_top_level(body: str) -> list[str]:
    """Splits a CREATE TABLE body on commas that are not inside parentheses."""
    parts, depth, current = [], 0, ""
    for ch in body:
        depth += ch == "("
        depth -= ch == ")"
        if ch == "," and depth == 0:
            parts.append(current)
            current = ""
        else:
            current += ch
    return parts + [current]


def _sql_tables() -> dict[str, set[str]]:
    """Table name -> column names, parsed from the CREATE TABLE statements in init.sql."""
    tables = {}
    for name, body in _CREATE_TABLE.findall(_strip_comments(INIT_SQL.read_text(encoding="utf-8"))):
        columns = set()
        for line in _split_top_level(body):
            words = line.split()
            if words and words[0].upper() not in _NOT_A_COLUMN and not words[0][0].isdigit():
                columns.add(words[0].lower())
        tables[name.lower()] = columns
    return tables


def _model_tables() -> dict[str, set[str]]:
    return {name: {c.name for c in table.columns} for name, table in Base.metadata.tables.items()}


def test_init_sql_defines_every_model_table():
    """T74 - Every table the app uses is created by db/init.sql, and vice versa"""
    assert set(_sql_tables()) == set(_model_tables())


def test_init_sql_columns_match_models():
    """T75 - Each table has exactly the same columns in init.sql and the models"""
    sql, orm = _sql_tables(), _model_tables()
    mismatches = {t: {"only_in_sql": sql[t] - orm[t], "only_in_models": orm[t] - sql[t]} for t in orm if sql.get(t) != orm[t]}
    assert not mismatches, f"Schema drift between db/init.sql and models.py: {mismatches}"

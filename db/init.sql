-- =============================================================================
-- Wealth Intelligence Copilot — database schema (PostgreSQL)
--
-- Runs once, when the Docker database volume is first created
-- (see docker-compose.yml). The backend also creates any missing tables on
-- startup from app/models/models.py, but never alters existing ones.
--
-- Keep this file and models.py in sync: backend/tests/test_schema.py fails if
-- their tables or columns differ.
-- =============================================================================

-- pgvector: reserved for embedding-based document search (not used yet)
CREATE EXTENSION IF NOT EXISTS vector;
-- pgcrypto: provides gen_random_uuid() for primary keys
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- Accounts. Passwords are stored only as bcrypt hashes.
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,                     -- login name, unique per account
    hashed_password TEXT NOT NULL,                  -- bcrypt hash, never the plain password
    risk_tolerance TEXT DEFAULT 'moderate',         -- risk profile label; every account starts as 'moderate'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Positions a user holds. Prices are NOT stored here: they are fetched live
-- (and cached for 5 minutes) when the portfolio is valued.
CREATE TABLE holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,                           -- e.g. AAPL; the same ticker may appear in several accounts
    quantity NUMERIC NOT NULL,                      -- number of shares (fractions allowed)
    cost_basis NUMERIC,                             -- purchase price per share; NULL when unknown
    account_type TEXT DEFAULT 'taxable',            -- taxable / ira / roth_ira / 401k
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_holdings_user ON holdings(user_id);


-- Audit trail: every recommendation and portfolio strategy the copilot gives,
-- stored in full so any answer can be reviewed later (GET /decisions/journal).
CREATE TABLE decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker TEXT,                                    -- NULL for portfolio-wide strategies
    query_text TEXT NOT NULL,                       -- the user's question as asked
    recommendation_json JSONB NOT NULL,             -- the complete answer returned to the user
    confidence NUMERIC,                             -- 0–1, as reported by the composer
    evidence_diversity_score NUMERIC,               -- 0–1 agreement between agents (low = they disagreed)
    prompt_version TEXT NOT NULL DEFAULT 'v1',      -- prompt set that produced the answer
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decisions_user_time ON decisions(user_id, created_at DESC);


-- Private documents a user uploads (research notes, reports). Only the
-- extracted text is kept; it is cited when the user asks about a company it mentions.
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,                     -- MIME type of the original upload
    size_bytes INTEGER NOT NULL,                    -- size of the original file
    text_content TEXT NOT NULL,                     -- extracted plain text (capped by the backend)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_user ON documents(user_id);


-- Cache of external evidence per ticker (news sentiment, fundamentals, price
-- trend), shared by all users. Fresh items are reused instead of calling the
-- data providers again; only the newest items per source are kept.
CREATE TABLE evidence_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL,
    source_type TEXT NOT NULL,                      -- sentiment / filing / price_volume
    payload JSONB NOT NULL,                         -- the provider's data, as used by the agents
    reliability_weight NUMERIC DEFAULT 1.0,         -- trust weight by source: news 0.7, fundamentals 0.9, price 1.0
    retrieved_at TIMESTAMPTZ DEFAULT now()          -- when it was fetched; drives freshness
);
CREATE INDEX idx_evidence_ticker_time ON evidence_items(ticker, retrieved_at DESC);


-- Investment preferences that personalise the advice (one row per user,
-- created the first time they save their profile). Risk tolerance itself is
-- users.risk_tolerance.
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    horizon_years INTEGER,                          -- years until the money is needed; NULL = not set
    max_position_pct NUMERIC NOT NULL DEFAULT 25,   -- concentration limit for any one ticker, in %
    updated_at TIMESTAMPTZ DEFAULT now()
);


-- What a user owns besides their stock holdings, so net worth and retirement
-- answers see the whole picture.
CREATE TABLE other_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                             -- e.g. "Emergency fund", "Rental flat"
    asset_class TEXT NOT NULL,                      -- cash / bonds / property / other
    value NUMERIC NOT NULL,                         -- current value in dollars, entered by the user
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_other_assets_user ON other_assets(user_id);


-- In-app notifications (position over limit, big daily drop, new SEC filing,
-- upcoming earnings, strategy changes). dedupe_key names the event, so the
-- periodic checks never create the same alert twice.
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,                             -- concentration / price_drop / filing / earnings / strategy_change
    ticker TEXT,                                    -- NULL for portfolio-wide alerts
    message TEXT NOT NULL,
    dedupe_key TEXT NOT NULL,                       -- e.g. "filing:AAPL:0000320193-25-000079"
    created_at TIMESTAMPTZ DEFAULT now(),
    read_at TIMESTAMPTZ,                            -- NULL = unread
    CONSTRAINT uq_alerts_user_key UNIQUE (user_id, dedupe_key)
);
CREATE INDEX idx_alerts_user ON alerts(user_id);

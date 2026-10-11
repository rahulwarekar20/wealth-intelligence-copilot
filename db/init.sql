CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    risk_tolerance TEXT DEFAULT 'moderate',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    cost_basis NUMERIC,
    account_type TEXT DEFAULT 'taxable',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_holdings_user ON holdings(user_id);

CREATE TABLE decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker TEXT,
    query_text TEXT NOT NULL,
    recommendation_json JSONB NOT NULL,
    confidence NUMERIC,
    evidence_diversity_score NUMERIC,
    prompt_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decisions_user_time ON decisions(user_id, created_at DESC);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    text_content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_user ON documents(user_id);

CREATE TABLE evidence_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL,
    source_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    reliability_weight NUMERIC DEFAULT 1.0,
    retrieved_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_evidence_ticker_time ON evidence_items(ticker, retrieved_at DESC);

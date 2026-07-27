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

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    role TEXT CHECK (role IN ('user','assistant')) NOT NULL,
    content TEXT NOT NULL,
    agent_attribution_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_session ON chat_messages(session_id, created_at ASC);

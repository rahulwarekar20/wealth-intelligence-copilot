# Wealth Intelligence Copilot (WIC)

An AI-powered investment decision support platform that helps investors make informed decisions using evidence-graded, portfolio-aware recommendations.

> **Live demo:** `http://localhost:3000` — login with `test@example.com` / `testpass123`

---

## What it does

- **Portfolio Strategy** — evaluates ALL your positions simultaneously and gives buy/hold/sell recommendations for each one
- **Ask Copilot** — chat with a 5-agent AI system about any stock or your full portfolio
- **Decision Journal** — every recommendation is logged with timestamp, confidence score, and reasoning
- **Retirement Planner** — answers "when can I retire?" with a projection based on your savings and expenses
- **Document Upload** — upload financial documents for the AI to use as evidence

---

## Quick Start (3 minutes)

**Prerequisites:** Docker Desktop, Python 3.11+, Node.js 18+

**1. Start and build the database**

    docker-compose up -d

Wait for `wealth_copilot_db (healthy)` — the schema is created automatically on first run from `db/init.sql`

**2. Start the backend**

    cd backend
    venv\Scripts\activate
    pip install -r requirements.txt
    python -m app.seed
    uvicorn app.main:app --port 8000

Wait for `Application startup complete`

**3. Start the frontend**

    cd frontend
    npm install
    npm run dev

Open `http://localhost:3000`

---

## What the seed script does

    python -m app.seed

Creates a demo user (`test@example.com` / `testpass123`) and seeds 5 portfolio holdings (AAPL, GOOGL, SPY, JPM, MSFT) so the dashboard has real data to show immediately.

---

## Demo Flow (5 minutes)

1. **Dashboard** — see live portfolio value and concentration analysis
2. **Analyse Portfolio** — AI strategy across all positions simultaneously
3. **Ask Copilot** — type `AAPL` + ask a question — watch 5 agents reason
4. **Journal** — see the decision logged automatically
5. **Retirement Plan** — enter details and see when you can retire
6. **Documents** — upload a financial PDF as AI evidence

---

## Architecture

- **Frontend:** React / Next.js 16 with Tailwind CSS
- **Backend:** FastAPI (Python 3.11)
- **Database:** PostgreSQL with pgvector extension
- **AI Orchestration:** LangGraph 5-agent framework
- **LLM Provider:** Groq (development) / Amazon Bedrock (production target)
- **Infrastructure:** AWS (ECS Fargate, RDS, S3, Cognito, CloudWatch)

---

## 5-Agent System

| Agent | Role |
|---|---|
| Supervisor Agent | Classifies intent and routes to specialist agents |
| Portfolio Agent | Analyses concentration risk across your holdings |
| Evidence Agent | Gathers news sentiment and company fundamentals |
| Market Data Agent | Interprets live price and momentum signals |
| Recommendation Composer | Synthesises all outputs into a structured recommendation |

---

## Key Differentiators

- **Portfolio-aware** — every recommendation considers your full portfolio, not just one stock
- **Evidence diversity scoring** — surfaces when agents agree or disagree
- **Full attribution** — shows which agent contributed which insight
- **Disagreement flagging** — explicitly flags when evidence sources conflict
- **Decision journal** — logs every recommendation for future outcome tracking

---

## Test Coverage

40/40 tests passing across 5 test suites:

| Suite | Tests | What it covers |
|---|---|---|
| test_auth.py | 9 | Signup, login, JWT validation, protected routes |
| test_portfolio.py | 7 | Holdings CRUD, data isolation between users |
| test_security.py | 5 | Token validation, SQL injection, input validation |
| test_guardrails.py | 6 | Evidence diversity scorer, AI guardrail logic |
| test_decisions.py | 13 | Journal, evidence endpoints, cross-user security |

Run the tests:

    cd backend
    pytest tests/ -v

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| /health | GET | Service health check |
| /auth/signup | POST | Register new user |
| /auth/login | POST | Login, returns JWT token |
| /auth/me | GET | Get current user profile |
| /portfolio/holdings | GET / POST / DELETE | Manage portfolio holdings |
| /portfolio/summary | GET | Live prices, net worth, concentration |
| /evidence/{ticker} | GET | Gather evidence for a ticker |
| /decisions/query | POST | Run 5-agent analysis for a single stock |
| /decisions/portfolio-strategy | GET | Run strategy across ALL positions |
| /decisions/journal | GET | List past recommendations |
| /documents/upload | POST | Upload a financial document |

---

## Security

- JWT authentication on every protected route
- User data isolation enforced at the database query layer (not just API layer)
- HTTP security headers on every response (X-Frame-Options, X-Content-Type-Options, CSP)
- Input validation via Pydantic on every endpoint
- Startup self-check warns if default credentials or missing API keys are detected
- Rate limiting on LLM-backed endpoints

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env`:

- DATABASE_URL — PostgreSQL connection string
- JWT_SECRET — generate with `python -c "import secrets; print(secrets.token_hex(32))"`
- FINNHUB_API_KEY — get from finnhub.io
- GROQ_API_KEY — get from console.groq.com
- AWS_REGION — us-east-1
- AWS_ACCESS_KEY_ID — your IAM user key
- AWS_SECRET_ACCESS_KEY — your IAM user secret

---

## Specification Documents

- Document 1: Product Vision and Business Requirements
- Document 2: Software Requirements Specification
- Document 3: Solution Architecture Document with C4 diagrams
- Document 4: Technical Design and Developer Guide
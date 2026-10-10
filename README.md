# Wealth Intelligence Copilot (WIC)

An AI-powered investment decision support platform that helps investors make informed decisions using evidence-graded, portfolio-aware recommendations.

## What it does

- **Portfolio Strategy** — evaluates ALL your positions simultaneously and gives buy/hold/sell recommendations for each one
- **Ask Copilot** — chat with a 5-agent AI system about any stock or your full portfolio
- **Decision Journal** — every recommendation is logged with timestamp, confidence score, and reasoning
- **Retirement Planner** — answers "when can I retire?" with a projection based on your savings and expenses
- **Document Upload** — upload financial documents for the AI to use as evidence

## Architecture

- **Frontend:** React / Next.js 16 with Tailwind CSS
- **Backend:** FastAPI (Python 3.11)
- **Database:** PostgreSQL with pgvector extension
- **AI Orchestration:** LangGraph 5-agent framework
- **LLM Provider:** Groq (development) / Amazon Bedrock (production target)
- **Infrastructure:** AWS (ECS Fargate, RDS, S3, Cognito, CloudWatch)

## 5-Agent System

| Agent | Role |
|---|---|
| Supervisor Agent | Classifies intent and routes to specialist agents |
| Portfolio Agent | Analyses concentration risk across your holdings |
| Evidence Agent | Gathers news sentiment and company fundamentals |
| Market Data Agent | Interprets live price and momentum signals |
| Recommendation Composer | Synthesises all outputs into a structured recommendation |

## Key Differentiators

- **Portfolio-aware** — every recommendation considers your full portfolio, not just one stock in isolation
- **Evidence diversity scoring** — surfaces when agents agree or disagree
- **Full attribution** — shows which agent contributed which insight
- **Disagreement flagging** — explicitly flags when evidence sources conflict
- **Decision journal** — logs every recommendation for future outcome tracking

## Pages

| Page | URL | Description |
|---|---|---|
| Dashboard | /dashboard | Live portfolio value, holdings table, concentration bars |
| Analyse Portfolio | /strategy | AI strategy across all positions simultaneously |
| Ask Copilot | /chat | Chat interface — single stock or full portfolio (type ALL) |
| Journal | /journal | Past decisions with confidence scores |
| Documents | /upload | Upload financial documents as AI evidence |
| Retirement Plan | /retire | Retirement projection calculator |

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

## Local Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker Desktop
- AWS CLI configured

### 1. Start the database

    docker-compose up -d

### 2. Start the backend

    cd backend
    python -m venv venv
    venv\Scripts\activate
    pip install -r requirements.txt
    python -m app.seed
    uvicorn app.main:app --port 8000

### 3. Start the frontend

    cd frontend
    npm install
    npm run dev

### 4. Open the app

    http://localhost:3000

Demo login: test@example.com / testpass123

## Environment Variables

## Specification Documents

- Document 1: Product Vision and Business Requirements
- Document 2: Software Requirements Specification
- Document 3: Solution Architecture Document with C4 diagrams
- Document 4: Technical Design and Developer Guide
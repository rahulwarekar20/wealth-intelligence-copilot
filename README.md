# Wealth Intelligence Copilot

An AI-powered investment decision support platform that helps investors make informed decisions using evidence-graded, portfolio-aware recommendations.

## Architecture

- **Frontend:** React/Next.js with Tailwind CSS
- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL with pgvector
- **AI Orchestration:** LangGraph 5-agent framework
- **Foundation Models:** Amazon Bedrock (Claude)
- **Infrastructure:** AWS (ECS Fargate, RDS, S3, Cognito, CloudWatch)

## 5-Agent System

| Agent | Role |
|---|---|
| Supervisor Agent | Classifies intent and routes to specialist agents |
| Portfolio Agent | Analyzes concentration and portfolio impact |
| Evidence Agent | Gathers news sentiment and fundamentals |
| Market Data Agent | Interprets live price and momentum signals |
| Recommendation Composer | Synthesizes all outputs into a structured recommendation |

## Key Features

- **Portfolio-aware recommendations** — every evaluation considers existing holdings
- **Evidence diversity scoring** — surfaces agreement and disagreement across sources
- **Multi-agent attribution** — shows which agent contributed which insight
- **Decision journal** — logs every recommendation with timestamps
- **Disagreement flagging** — explicitly surfaces when agents conflict

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker Desktop
- AWS CLI configured

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Database
```bash
docker-compose up -d
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| /auth/signup | POST | Register a new user |
| /auth/login | POST | Login and get JWT token |
| /portfolio/holdings | GET/POST | Manage portfolio holdings |
| /portfolio/summary | GET | Live prices, net worth, concentration |
| /evidence/{ticker} | GET | Gather evidence for a ticker |
| /decisions/query | POST | Run 5-agent analysis |
| /decisions/journal | GET | View past decisions |

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in your own values:

```
DATABASE_URL=postgresql+psycopg2://wealth:password@localhost:5432/wealth_copilot
JWT_SECRET=generate_with_python_secrets_token_hex_32
FINNHUB_API_KEY=get_from_finnhub.io
GROQ_API_KEY=get_from_console.groq.com
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_iam_user_key
AWS_SECRET_ACCESS_KEY=your_iam_user_secret
```

## Documents

This project includes four specification documents:
- Document 1: Product Vision & Business Requirements
- Document 2: Software Requirements Specification  
- Document 3: Solution Architecture Document
- Document 4: Technical Design & Developer Guide
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth
from app.api import portfolio
from app.api import evidence
from app.api import decisions
from app.api import documents

app = FastAPI(
    title="Wealth Intelligence Copilot",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(portfolio.router)
app.include_router(evidence.router)
app.include_router(decisions.router)
app.include_router(documents.router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "wealth-copilot-backend"}
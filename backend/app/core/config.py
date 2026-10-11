from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # extra="ignore" so old/unused keys in .env (e.g. AWS_*) don't break startup
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    ALPHA_VANTAGE_API_KEY: str = ""
    FINNHUB_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    # SEC EDGAR requires a descriptive User-Agent with a contact email
    SEC_USER_AGENT: str = "WealthIntelligenceCopilot admin@example.com"
    # Comma-separated list of frontend origins allowed by CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()

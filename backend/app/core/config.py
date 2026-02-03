from __future__ import annotations
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://mockbank:mockbankpass@localhost:5432/mockbank"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "dev_secret_change_me"
    ACCESS_TOKEN_EXPIRE_MIN: int = 30
    WEBHOOK_URL: str = "http://localhost:8000/webhooks/transfer-status"

    RATE_LIMIT_PER_MIN_BALANCE: int = 60
    RATE_LIMIT_PER_MIN_TRANSFER: int = 10

    CORS_ORIGINS: str = "http://localhost:3000"

    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

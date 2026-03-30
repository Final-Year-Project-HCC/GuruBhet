from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import PostgresDsn, RedisDsn, field_validator
from typing import Any


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # ── Project ──────────────────────────────────────────────────────
    PROJECT_NAME: str = "GuruBhet"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"  # development | staging | production

    # ── Security ─────────────────────────────────────────────────────
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Database ─────────────────────────────────────────────────────
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    # Transaction mode — used by the FastAPI app (port 6543 on Supavisor)
    # Supavisor transaction mode does not support prepared statements,
    # so we disable them via ?prepared_statement_cache_size=0
    DATABASE_URL: PostgresDsn
    # Session mode — used by Alembic only (port 5432 on Supavisor)
    # Alembic needs a persistent connection to run DDL (CREATE TABLE etc.)
    # which transaction mode cannot support
    DATABASE_URL_ALEMBIC: PostgresDsn


    # ── Redis ─────────────────────────────────────────────────────────
    REDIS_BASE_URL : RedisDsn
    REDIS_URL: RedisDsn

    # ── CORS ─────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",  # Frontend (React/Vue)
        "http://localhost:8000",  # Swagger UI (for development/testing)
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ]

    # ── eSewa ────────────────────────────────────────────────────────
    ESEWA_MERCHANT_CODE: str
    ESEWA_SECRET_KEY: str
    ESEWA_BASE_URL: str = "https://rc-epay.esewa.com.np"  # staging default
    ESEWA_PLATFORM_ACCOUNT: str  # GuruBhet's own eSewa phone number

    # ── LiveKit ──────────────────────────────────────────────────────
    LIVEKIT_API_KEY: str
    LIVEKIT_API_SECRET: str
    LIVEKIT_URL: str
    LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN: int  # minutes of leniency per 15-minute session block
    LIVEKIT_EMPTY_TIMEOUT_SECONDS: int = 86400  # 24 hours fallback (Celery task is primary controller)

    # ── S3 / Object Storage ──────────────────────────────────────────
    S3_ENDPOINT_URL: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    AWS_REGION: str 
    S3_BUCKET_DOCUMENTS: str = "gurubhet-documents"
    S3_BUCKET_RECORDINGS: str = "gurubhet-recordings"

    # ── Celery ───────────────────────────────────────────────────────
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str

    # ── Payout schedule ──────────────────────────────────────────────
    PAYOUT_DAY_OF_WEEK: int = 0          # Monday
    PLATFORM_FEE_PERCENT: float = 10.0   # GuruBhet takes 10%

    # ── Email (optional SMTP) ────────────────────────────────────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = "noreply@gurubhet.com"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_url(cls, v: Any) -> Any:
        """Append prepared_statement_cache_size=0 for transaction mode (Supavisor)"""
        if isinstance(v, str):
            separator = "&" if "?" in v else "?"
            return f"{v}{separator}prepared_statement_cache_size=0"
        return v


settings = Settings()  # type: ignore[call-arg]
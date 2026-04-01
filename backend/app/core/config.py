from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import PostgresDsn, RedisDsn, field_validator
from typing import Any, List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # 1. Look for .env file (Mac Dev) 
        # 2. If not found, use OS Env variables (Docker Prod)
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"  # Won't crash if .env has AZURE_PUBLIC_IP etc.
    )

    # ── Project ──────────────────────────────────────────────────────
    PROJECT_NAME: str = "GuruBhet"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # ── Security ─────────────────────────────────────────────────────
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Database ─────────────────────────────────────────────────────
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    # Transaction mode (Supavisor 6543)
    DATABASE_URL: PostgresDsn
    # Session mode (Alembic 5432)
    DATABASE_URL_ALEMBIC: PostgresDsn

    # ── Redis ─────────────────────────────────────────────────────────
    REDIS_URL: RedisDsn

    # ── CORS ─────────────────────────────────────────────────────────
    # This list allows your Local Mac Frontend to talk to your Azure VPS Backend
    ALLOWED_ORIGINS: List[str] = [
        # --- LOCAL DEVELOPMENT (MacBook M4) ---
        "http://localhost:3000",      # Student Local
        "http://localhost:3001",      # Teacher Local
        "http://localhost:3002",      # Staff Local
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",

        # --- PRODUCTION (Azure VPS) ---
        "https://gurubhet.tech",
        "https://api.gurubhet.tech",
        "https://teacher.gurubhet.tech",
        "https://staff.gurubhet.tech",
        "https://tasks.gurubhet.tech",
    ]

    # ── eSewa ────────────────────────────────────────────────────────
    ESEWA_MERCHANT_CODE: str
    ESEWA_SECRET_KEY: str
    ESEWA_BASE_URL: str = "https://rc-epay.esewa.com.np"
    ESEWA_PLATFORM_ACCOUNT: str 

    # ── LiveKit ──────────────────────────────────────────────────────
    LIVEKIT_API_KEY: str
    LIVEKIT_API_SECRET: str
    LIVEKIT_URL: str
    LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN: int = 5
    LIVEKIT_EMPTY_TIMEOUT_SECONDS: int = 86400

    # ── Media Storage (Cloudinary) ──────────────────────────────────
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # ── Celery ───────────────────────────────────────────────────────
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str

    # ── Payout schedule ──────────────────────────────────────────────
    PAYOUT_DAY_OF_WEEK: int = 0          
    PLATFORM_FEE_PERCENT: float = 10.0   

    # ── Email ────────────────────────────────────────────────────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = "noreply@gurubhet.com"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_url(cls, v: Any) -> Any:
        """Append statement cache size for Supavisor compatibility"""
        if isinstance(v, str) and "prepared_statement_cache_size" not in v:
            separator = "&" if "?" in v else "?"
            return f"{v}{separator}prepared_statement_cache_size=0"
        return v

settings = Settings()
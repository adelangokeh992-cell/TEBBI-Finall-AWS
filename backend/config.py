"""
Central application settings loaded from environment.
Uses pydantic-settings for validation and .env loading.
"""
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # MongoDB
    mongo_url: str = Field(default="mongodb://localhost:27017", alias="MONGO_URL")
    db_name: str = Field(default="tebbi", alias="DB_NAME")

    # JWT (default 32+ chars to satisfy RFC 7518 / PyJWT; still set JWT_SECRET in production)
    jwt_secret: str = Field(
        default="tebbi_dev_secret_do_not_use_in_production_32chars",
        alias="JWT_SECRET",
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_expiration_hours: int = Field(default=24, alias="JWT_EXPIRATION_HOURS")
    # Session idle: logout after this many minutes of no activity (default 15)
    session_idle_timeout_minutes: int = Field(default=15, alias="SESSION_IDLE_TIMEOUT_MINUTES")

    # Encryption (optional; if unset, crypto_utils derives from jwt_secret)
    encryption_key: str = Field(default="", alias="ENCRYPTION_KEY")

    # CORS (comma-separated list)
    cors_origins: str = Field(default="*", alias="CORS_ORIGINS")

    # Production mode: hide /docs and /redoc, stricter defaults
    production: bool = Field(default=False, alias="PRODUCTION")

    # API rate limit: requests per minute per IP for /api/* (avoids 429 when UI loads many resources)
    api_rate_limit_per_minute: int = Field(default=400, alias="API_RATE_LIMIT_PER_MINUTE")

    def get_cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_jwt_default(self) -> bool:
        return (
            not self.jwt_secret
            or self.jwt_secret == "tebbi_secret_key"
            or self.jwt_secret == "tebbi_dev_secret_do_not_use_in_production_32chars"
        )

    @property
    def is_encryption_key_secure(self) -> bool:
        """True if ENCRYPTION_KEY is explicitly set and at least 32 bytes (required in production)."""
        key = (self.encryption_key or "").strip()
        return len(key) >= 32

    def validate_production(self) -> None:
        """
        In production, refuse to start if security requirements are not met.
        Raises RuntimeError with a clear message.
        """
        if not self.production:
            return
        errors: List[str] = []
        if self.is_jwt_default:
            errors.append(
                "JWT_SECRET must be set to a strong random value (32+ chars) in production. "
                "Do not use the default dev secret."
            )
        if not self.is_encryption_key_secure:
            errors.append(
                "ENCRYPTION_KEY must be set in production (at least 32 bytes). "
                "Do not rely on derivation from JWT_SECRET for PHI encryption."
            )
        if self.cors_origins.strip() == "*":
            errors.append(
                "CORS_ORIGINS must not be '*' in production. Set explicit frontend origin(s), e.g. https://app.example.com"
            )
        if errors:
            raise RuntimeError(
                "Production security check failed:\n" + "\n".join(f"  - {e}" for e in errors)
            )


# Singleton loaded at first import
settings = Settings()

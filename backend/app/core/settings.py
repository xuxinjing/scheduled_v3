"""Application settings loaded from environment variables."""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    app_env: str
    frontend_url: str | None
    cors_origins_raw: str | None
    anthropic_api_key: str | None
    anthropic_integrity_model: str | None
    integrity_check_mode: str
    integrity_max_tokens: int
    integrity_temperature: float
    integrity_timeout_seconds: float
    resend_api_key: str | None
    email_from: str | None
    s3_bucket: str | None
    s3_access_key: str | None
    s3_secret_key: str | None
    s3_region: str | None
    s3_endpoint_url: str | None
    s3_public_base_url: str | None

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def cors_origins(self) -> list[str]:
        if self.cors_origins_raw:
            return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]
        if self.frontend_url:
            return [self.frontend_url]
        return ["*"]

    @property
    def integrity_configured(self) -> bool:
        return bool(self.anthropic_api_key and self.anthropic_integrity_model)

    @property
    def s3_configured(self) -> bool:
        return bool(self.s3_bucket and self.s3_access_key and self.s3_secret_key)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    app_env = os.getenv("APP_ENV", "development")
    default_integrity_mode = "required" if app_env.lower() == "production" else "best_effort"
    return Settings(
        app_env=app_env,
        frontend_url=os.getenv("FRONTEND_URL"),
        cors_origins_raw=os.getenv("CORS_ORIGINS"),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
        anthropic_integrity_model=os.getenv("ANTHROPIC_INTEGRITY_MODEL"),
        integrity_check_mode=os.getenv("INTEGRITY_CHECK_MODE", default_integrity_mode),
        integrity_max_tokens=int(os.getenv("INTEGRITY_MAX_TOKENS", "1024")),
        integrity_temperature=float(os.getenv("INTEGRITY_TEMPERATURE", "0")),
        integrity_timeout_seconds=float(os.getenv("INTEGRITY_TIMEOUT_SECONDS", "60")),
        resend_api_key=os.getenv("RESEND_API_KEY"),
        email_from=os.getenv("EMAIL_FROM"),
        s3_bucket=os.getenv("S3_BUCKET"),
        s3_access_key=os.getenv("S3_ACCESS_KEY"),
        s3_secret_key=os.getenv("S3_SECRET_KEY"),
        s3_region=os.getenv("S3_REGION"),
        s3_endpoint_url=os.getenv("S3_ENDPOINT_URL"),
        s3_public_base_url=os.getenv("S3_PUBLIC_BASE_URL"),
    )

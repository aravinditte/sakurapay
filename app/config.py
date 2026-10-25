import os


class Settings:
    app_env = os.getenv("APP_ENV", "development")
    app_name = os.getenv("APP_NAME", "SakuraPay")
    database_url = os.getenv("DATABASE_URL", "sqlite:///./sakurapay.db")
    jwt_secret = os.getenv("JWT_SECRET_KEY", "sakurapay-jwt-secret-key-super-secure-32bytes-minimum!")
    jwt_minutes = int(os.getenv("JWT_ACCESS_TOKEN_MINUTES", "15"))
    webhook_timeout = float(os.getenv("WEBHOOK_TIMEOUT_SECONDS", "5"))
    webhook_max_attempts = int(os.getenv("WEBHOOK_MAX_ATTEMPTS", "5"))
    auto_create_tables = os.getenv("AUTO_CREATE_TABLES", "true").lower() == "true"
    # Private/loopback webhook targets are allowed only in development by default (local demo receiver).
    allow_private_webhooks = (
        os.getenv(
            "ALLOW_PRIVATE_WEBHOOKS",
            "true" if os.getenv("APP_ENV", "development") == "development" else "false",
        ).lower()
        == "true"
    )
    rate_limit_per_minute = int(os.getenv("RATE_LIMIT_PER_MINUTE", "600"))
    auth_rate_limit_per_minute = int(os.getenv("AUTH_RATE_LIMIT_PER_MINUTE", "60"))
    idempotency_retention_hours = int(os.getenv("IDEMPOTENCY_RETENTION_HOURS", "24"))


settings = Settings()

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./yieldlab.db"
    FRONTEND_URL: str = "http://localhost:3100"
    AUTO_APPROVE_THRESHOLD: int = 1
    # "mock" = モックスクレイパー常用 / "playwright" = Expedia実スクレイプ
    SCRAPER_MODE: str = "mock"
    # 追加許可オリジン（カンマ区切り）
    EXTRA_CORS_ORIGINS: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def allowed_origins(self) -> list[str]:
        origins = [self.FRONTEND_URL, "http://localhost:3000", "http://localhost:3100"]
        if self.EXTRA_CORS_ORIGINS:
            origins += [o.strip() for o in self.EXTRA_CORS_ORIGINS.split(",") if o.strip()]
        return list(set(origins))


settings = Settings()

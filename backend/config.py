from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./yieldlab.db"
    FRONTEND_URL: str = "http://localhost:3100"
    AUTO_APPROVE_THRESHOLD: int = 1
    # "mock" = モックスクレイパー常用 / "playwright" = Expedia実スクレイプ
    SCRAPER_MODE: str = "mock"
    # 追加許可オリジン（カンマ区切り）
    EXTRA_CORS_ORIGINS: str = ""
    # IMAP 設定（ゲストチャット自動取り込み用。未設定時はポーリング無効）
    IMAP_HOST:     str = ""
    IMAP_USER:     str = ""
    IMAP_PASSWORD: str = ""

    model_config = SettingsConfigDict(
        # CWD が yieldlab-app/ になる場合も backend/.env を参照できるよう両方指定
        env_file=[".env", "backend/.env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        # 空の場合はSQLiteフォールバック
        if not v or v.strip() == "":
            return "sqlite+aiosqlite:///./yieldlab.db"
        # Railway/Herokuが返す postgres:// を asyncpg 対応形式に変換
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://") and "+asyncpg" not in v:
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    def allowed_origins(self) -> list[str]:
        origins = [
            self.FRONTEND_URL,
            "http://localhost:3000",
            "http://localhost:3010",
            "http://localhost:3100",
            # Vercel本番ドメイン
            "https://app.yieldlab.dev",
            "https://yieldlab.dev",
            # Vercelプレビューデプロイ（*.vercel.app）はEXTRA_CORS_ORIGINSで追加
        ]
        if self.EXTRA_CORS_ORIGINS:
            origins += [o.strip() for o in self.EXTRA_CORS_ORIGINS.split(",") if o.strip()]
        return list(set(origins))


settings = Settings()

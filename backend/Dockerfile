FROM python:3.11-slim

# Playwright実行に必要なシステム依存関係
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# SCRAPER_MODE=playwright の場合のみブラウザをインストール
# デフォルトはmockモードなのでスキップ可能（ビルド引数で制御）
ARG INSTALL_PLAYWRIGHT_BROWSERS=false
RUN if [ "$INSTALL_PLAYWRIGHT_BROWSERS" = "true" ]; then \
      playwright install chromium --with-deps; \
    fi

COPY . .

# PORT は Railway が自動設定。デフォルト8000
ENV PORT=8000

CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}

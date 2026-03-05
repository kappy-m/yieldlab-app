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

# Railwayはリポジトリルートをビルドコンテキストとして渡すため、
# backend/ プレフィックスを付けて参照する
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

ARG INSTALL_PLAYWRIGHT_BROWSERS=false
RUN if [ "$INSTALL_PLAYWRIGHT_BROWSERS" = "true" ]; then \
      playwright install chromium --with-deps; \
    fi

# ソース全体をコピー（backend/ と同階層の構造を維持）
COPY . .

# PORT は Railway が自動設定。デフォルト8000
ENV PORT=8000

CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}

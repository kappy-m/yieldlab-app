FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ビルドコンテキストはリポジトリルート
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

ARG INSTALL_PLAYWRIGHT_BROWSERS=false
RUN if [ "$INSTALL_PLAYWRIGHT_BROWSERS" = "true" ]; then \
      playwright install chromium --with-deps; \
    fi

# ソース全体をコピー（backend/ パッケージとして認識させる）
COPY . .

ENV PORT=8000

CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}

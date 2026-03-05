FROM python:3.11-slim

WORKDIR /app

# システム依存パッケージ（Playwright Chromium 実行に必要）
RUN apt-get update && apt-get install -y \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 \
    libgbm1 libdrm2 libxkbcommon0 libasound2 libpango-1.0-0 libcairo2 \
    wget ca-certificates \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Pythonパッケージインストール
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Playwright Chromium インストール（実スクレイプ用 / scrape_mode="live" 時に使用）
RUN pip install --no-cache-dir playwright && playwright install chromium

# ソースコード全体をコピー（backend/ がパッケージとして認識される）
COPY . .

ENV PORT=8000

CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}

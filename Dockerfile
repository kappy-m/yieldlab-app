FROM python:3.11-slim

WORKDIR /app

# Pythonパッケージインストール
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ソースコード全体をコピー（backend/ がパッケージとして認識される）
COPY . .

ENV PORT=8000

CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}

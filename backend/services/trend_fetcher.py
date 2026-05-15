"""
Google Trends バッチフェッチャー（CP1）。

pytrends（非公式ライブラリ）を使いエリア×旅行クエリのトレンド指数を週1回取得し、
google_trends_cache テーブルに保存する。

IPブロック対策:
  - APScheduler から月曜 03:00 JST に実行（深夜低トラフィック帯）
  - リクエスト間に sleep(randint(5, 15)) を挿入
  - User-Agent をブラウザ形式に明示設定
  - 連続3週失敗した場合は管理画面に SerpAPI 移行アラートを表示予定（TODOS: Deferred）

フォールバック: 取得失敗時は係数 1.0（GoogleTrendsSignal 側で処理）
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from random import randint
from time import sleep

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.google_trends_cache import GoogleTrendsCache

logger = logging.getLogger(__name__)

# エリアコード → Google Trends 地域コード (geo パラメータ)
_AREA_GEO: dict[str, str] = {
    "nihonbashi": "JP-13",  # 東京都
    "ginza":      "JP-13",
    "shinjuku":   "JP-13",
    "asakusa":    "JP-13",
    "shibuya":    "JP-13",
    "ikebukuro":  "JP-13",
}
_DEFAULT_GEO = "JP-13"

# エリアごとに検索するクエリ
_AREA_QUERIES: dict[str, list[str]] = {
    "nihonbashi": ["日本橋 ホテル", "日本橋 旅行", "ホテル"],
    "ginza":      ["銀座 ホテル", "銀座 旅行", "ホテル"],
    "shinjuku":   ["新宿 ホテル", "新宿 旅行", "ホテル"],
}
_DEFAULT_QUERIES = ["ホテル", "旅行", "宿泊"]


async def fetch_and_store_trends(area_code: str, db: AsyncSession) -> int:
    """
    指定エリアの Google Trends データを取得して DB に保存する。

    Returns:
        保存/更新したレコード数（0 = 失敗 or データなし）
    """
    try:
        from pytrends.request import TrendReq
    except ImportError:
        logger.warning("[TrendFetcher] pytrends がインストールされていません。pip install pytrends を実行してください。")
        return 0

    geo = _AREA_GEO.get(area_code, _DEFAULT_GEO)
    queries = _AREA_QUERIES.get(area_code, _DEFAULT_QUERIES)
    today = date.today()
    # 直近 4 週分（月ごとの季節性を捕捉するため）
    timeframe = "today 1-m"

    saved = 0
    for query in queries:
        try:
            pytrends = TrendReq(
                hl="ja-JP",
                tz=540,  # JST
                timeout=(10, 25),
                requests_args={
                    "headers": {
                        "User-Agent": (
                            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/120.0.0.0 Safari/537.36"
                        )
                    }
                },
            )
            pytrends.build_payload([query], geo=geo, timeframe=timeframe)
            df = pytrends.interest_over_time()

            if df is None or df.empty:
                logger.info("[TrendFetcher] データなし: area=%s query=%s", area_code, query)
                continue

            # 週次データを DB に保存
            for idx, row in df.iterrows():
                period_start = idx.date()
                period_end = period_start + timedelta(days=6)
                trend_index = float(row.get(query, 0))

                # UPSERT: 既存レコードがあれば更新
                existing = await db.execute(
                    select(GoogleTrendsCache).where(
                        and_(
                            GoogleTrendsCache.area_code == area_code,
                            GoogleTrendsCache.query == query,
                            GoogleTrendsCache.period_start == period_start,
                        )
                    )
                )
                record = existing.scalar_one_or_none()

                if record:
                    record.trend_index = trend_index
                    record.fetched_at = datetime.now(timezone.utc)
                    record.period_end = period_end
                else:
                    db.add(GoogleTrendsCache(
                        area_code=area_code,
                        query=query,
                        period_start=period_start,
                        period_end=period_end,
                        trend_index=trend_index,
                    ))
                saved += 1

            await db.commit()
            logger.info(
                "[TrendFetcher] 保存完了: area=%s query=%s rows=%d",
                area_code, query, saved,
            )

        except Exception as exc:
            logger.warning(
                "[TrendFetcher] 取得失敗 (area=%s, query=%s): %s → スキップ",
                area_code, query, exc,
            )

        # IPブロック対策: リクエスト間に乱数スリープ
        sleep(randint(5, 15))

    return saved


async def fetch_all_areas(areas: list[str], db: AsyncSession) -> dict[str, int]:
    """全エリアのトレンドデータを順番に取得する。"""
    results: dict[str, int] = {}
    for area in areas:
        results[area] = await fetch_and_store_trends(area, db)
    return results

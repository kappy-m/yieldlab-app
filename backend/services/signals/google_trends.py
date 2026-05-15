"""
Google Trends シグナル（CP1）。

google_trends_cache テーブルから週次データを読み、
その週のトレンド指数に基づいて需要係数を返す。

指数マッピング（0〜100）:
  ≥ 75 → 係数 1.2  (+20% demand: 急上昇)
  ≥ 55 → 係数 1.1  (+10%)
  ≥ 40 → 係数 1.0  (中立)
  ≥ 20 → 係数 0.95 (-5%)
  < 20  → 係数 0.9  (-10%: 著しく低い)

データが取得できない日は 1.0 にフォールバック。
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .base import BaseSignal

logger = logging.getLogger(__name__)

_DEFAULT_QUERIES = ["ホテル", "旅行", "宿泊"]


def _index_to_factor(trend_index: float) -> float:
    if trend_index >= 75:
        return 1.2
    if trend_index >= 55:
        return 1.1
    if trend_index >= 40:
        return 1.0
    if trend_index >= 20:
        return 0.95
    return 0.9


class GoogleTrendsSignal(BaseSignal):
    """google_trends_cache テーブルから需要係数を返す"""

    async def compute(
        self,
        dates: list[date],
        db: AsyncSession,
        area_code: str = "nihonbashi",
        queries: list[str] | None = None,
        **kwargs: object,
    ) -> dict[date, float]:
        if not dates:
            return {}

        from ...models.google_trends_cache import GoogleTrendsCache

        target_queries = queries or _DEFAULT_QUERIES
        min_date = min(dates) - timedelta(days=7)
        max_date = max(dates)

        try:
            res = await db.execute(
                select(
                    GoogleTrendsCache.period_start,
                    GoogleTrendsCache.period_end,
                    GoogleTrendsCache.trend_index,
                    GoogleTrendsCache.query,
                ).where(
                    and_(
                        GoogleTrendsCache.area_code == area_code,
                        GoogleTrendsCache.query.in_(target_queries),
                        GoogleTrendsCache.period_start >= min_date,
                        GoogleTrendsCache.period_end <= max_date + timedelta(days=7),
                    )
                )
            )
            rows = res.all()
        except Exception as exc:
            logger.warning("[GoogleTrendsSignal] DB読み込み失敗 → 中立: %s", exc)
            return self._neutral(dates)

        if not rows:
            logger.debug("[GoogleTrendsSignal] データなし (area=%s) → 中立", area_code)
            return self._neutral(dates)

        # 日付 → その週の平均トレンド指数にマップ
        result: dict[date, float] = {}
        for d in dates:
            week_start = d - timedelta(days=d.weekday())
            matching = [
                r.trend_index for r in rows
                if r.period_start <= week_start <= r.period_end
            ]
            if not matching:
                result[d] = 1.0
            else:
                avg_index = sum(matching) / len(matching)
                result[d] = _index_to_factor(avg_index)

        return result

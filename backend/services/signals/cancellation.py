"""
履歴キャンセル率シグナル（CP5）。

自社の DailyPerformance から「曜日 × 月」ごとの平均キャンセル率を算出し、
平均 + 1σ を超えた日程に需要補正を掛ける。

補正値:
  +1σ 超え → 係数 0.9  (-10% demand)
  +2σ 超え → 係数 0.8  (-20% demand)
  範囲内    → 係数 1.0
"""

from __future__ import annotations

import logging
import math
from datetime import date, timedelta

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .base import BaseSignal

logger = logging.getLogger(__name__)


class CancellationSignal(BaseSignal):
    """過去キャンセル率の統計から需要係数を返す"""

    LOOKBACK_DAYS = 365  # 年間トレンドを使う

    async def compute(
        self,
        dates: list[date],
        db: AsyncSession,
        property_id: int = 0,
        **kwargs: object,
    ) -> dict[date, float]:
        if not dates or not property_id:
            return self._neutral(dates)

        from ...models.daily_performance import DailyPerformance

        cutoff = date.today() - timedelta(days=self.LOOKBACK_DAYS)
        res = await db.execute(
            select(
                DailyPerformance.date,
                DailyPerformance.cancellations,
                DailyPerformance.new_bookings,
            ).where(
                and_(
                    DailyPerformance.property_id == property_id,
                    DailyPerformance.date >= cutoff,
                    DailyPerformance.date < date.today(),
                )
            )
        )
        rows = res.all()

        if not rows:
            return self._neutral(dates)

        # 曜日×月ごとのキャンセル率を集計
        bucket: dict[tuple[int, int], list[float]] = {}
        for row in rows:
            if row.new_bookings and row.new_bookings > 0:
                rate = row.cancellations / row.new_bookings
                key = (row.date.weekday(), row.date.month)
                bucket.setdefault(key, []).append(rate)

        if not bucket:
            return self._neutral(dates)

        # 全体の平均・標準偏差を算出
        all_rates = [r for rates in bucket.values() for r in rates]
        mean = sum(all_rates) / len(all_rates)
        variance = sum((r - mean) ** 2 for r in all_rates) / len(all_rates)
        sigma = math.sqrt(variance) if variance > 0 else 0.0

        result: dict[date, float] = {}
        for d in dates:
            key = (d.weekday(), d.month)
            bucket_rates = bucket.get(key)
            if not bucket_rates or sigma == 0:
                result[d] = 1.0
                continue

            bucket_mean = sum(bucket_rates) / len(bucket_rates)
            if bucket_mean > mean + 2 * sigma:
                result[d] = 0.8
            elif bucket_mean > mean + sigma:
                result[d] = 0.9
            else:
                result[d] = 1.0

        return result

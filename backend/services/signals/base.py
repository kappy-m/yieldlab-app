"""
SignalRegistry の基底クラス。

すべての需要シグナルはこのインターフェースを実装する。
返却値は日付ごとの乗算係数:
  1.0 = 中立（変化なし）
  0.6 = 需要 -40%
  1.3 = 需要 +30%

失敗時はすべての日付に 1.0 を返す（フォールバック標準化）。
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession


class BaseSignal(ABC):
    """需要シグナルの抽象基底クラス"""

    @abstractmethod
    async def compute(
        self,
        dates: list[date],
        db: AsyncSession,
        **kwargs: object,
    ) -> dict[date, float]:
        """
        対象日ごとの乗算係数を返す。
        失敗時は {d: 1.0 for d in dates} を返すこと。
        """

    def _neutral(self, dates: list[date]) -> dict[date, float]:
        return {d: 1.0 for d in dates}

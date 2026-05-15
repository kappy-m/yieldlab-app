"""
OpenMeteo 無料 API を使った天気シグナル。

気象警報相当（台風・暴風・大雪）の日程を検出し、需要を自動減衰させる。

WMO weather code マッピング:
  95-99 (Thunderstorm / Hail)  → factor = 0.6  (-40%: 台風・暴風相当)
  65-67 (Heavy rain / Freezing rain) → factor = 0.8  (-20%)
  73-77 (Moderate/Heavy snow)  → factor = 0.8  (-20%)
  その他                        → factor = 1.0  (中立)
"""

from __future__ import annotations

import logging
from datetime import date

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from .base import BaseSignal

logger = logging.getLogger(__name__)

# エリアコード → (latitude, longitude)
_AREA_COORDS: dict[str, tuple[float, float]] = {
    "nihonbashi": (35.6839, 139.7745),
    "ginza":      (35.6705, 139.7642),
    "shinjuku":   (35.6896, 139.6988),
    "asakusa":    (35.7148, 139.7967),
    "shibuya":    (35.6598, 139.7036),
    "ikebukuro":  (35.7295, 139.7109),
}
_DEFAULT_COORDS = (35.6762, 139.6503)  # 東京都庁


def _wmo_to_factor(code: int) -> float:
    if 95 <= code <= 99:
        return 0.6   # 台風・暴風・降雹
    if 65 <= code <= 67:
        return 0.8   # 強雨・着氷性雨
    if 73 <= code <= 77:
        return 0.8   # 中程度〜強い雪
    return 1.0


class WeatherSignal(BaseSignal):
    """OpenMeteo API から台風・大雪アラートを取得して需要係数を返す"""

    _API_BASE = "https://api.open-meteo.com/v1/forecast"
    _TIMEOUT = 10.0

    async def compute(
        self,
        dates: list[date],
        db: AsyncSession,
        event_area: str = "nihonbashi",
        **kwargs: object,
    ) -> dict[date, float]:
        if not dates:
            return {}

        lat, lon = _AREA_COORDS.get(event_area, _DEFAULT_COORDS)
        today = date.today()
        # OpenMeteo は最大16日先まで。それ以降は中立とする
        forecast_days = min(16, (max(dates) - today).days + 1)
        if forecast_days <= 0:
            return self._neutral(dates)

        try:
            async with httpx.AsyncClient(timeout=self._TIMEOUT) as client:
                resp = await client.get(
                    self._API_BASE,
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "daily": "weather_code",
                        "timezone": "Asia/Tokyo",
                        "forecast_days": forecast_days,
                    },
                )
            resp.raise_for_status()
            data = resp.json()

            date_strs: list[str] = data["daily"]["time"]
            codes: list[int] = data["daily"]["weather_code"]
            code_map = {
                date.fromisoformat(ds): code
                for ds, code in zip(date_strs, codes)
            }

            return {
                d: _wmo_to_factor(code_map[d]) if d in code_map else 1.0
                for d in dates
            }

        except Exception as exc:
            logger.warning("[WeatherSignal] API失敗 → 中立にフォールバック: %s", exc)
            return self._neutral(dates)

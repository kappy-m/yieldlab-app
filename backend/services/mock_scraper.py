"""
モックスクレイパー: 実Expedia接続なしで競合価格データを生成する。

実データモードへの切り替え方:
  CompSet.scrape_mode = "live" に変更するだけで
  scraper.py の Playwright スクレイパーに自動切り替えされる。
"""

import random
import math
from datetime import date, timedelta
from dataclasses import dataclass


@dataclass
class MockPrice:
    competitor_name: str
    target_date: str
    price: int
    available_rooms: int
    source_url: str


# 渋谷エリアの実在競合ホテル（Expedia IDは別途設定）
DEFAULT_COMP_HOTELS = [
    {"name": "ホテルA（セルリアンタワー周辺）", "base_price": 18000, "variance": 0.20},
    {"name": "ホテルB（渋谷駅近）",             "base_price": 15000, "variance": 0.15},
    {"name": "ホテルC（表参道エリア）",          "base_price": 22000, "variance": 0.25},
    {"name": "ホテルD（代官山）",               "base_price": 20000, "variance": 0.18},
    {"name": "ホテルE（恵比寿）",               "base_price": 17000, "variance": 0.20},
]


def _mock_price_for(base: int, variance: float, target: date, seed_offset: int = 0) -> int:
    """日付とシードに基づいて再現性のある価格を生成"""
    seed = target.toordinal() + seed_offset
    rng = random.Random(seed)

    # 曜日プレミアム
    weekday = target.weekday()
    dow_factor = 1.0
    if weekday in (4, 5):   # 金土
        dow_factor = 1.15
    elif weekday == 6:       # 日
        dow_factor = 1.05

    # 季節性（夏・冬ピーク）
    month = target.month
    season_factor = 1.0 + 0.1 * math.sin((month - 3) * math.pi / 6)

    # ランダム揺らぎ
    rand_factor = 1.0 + rng.uniform(-variance, variance)

    price = int(base * dow_factor * season_factor * rand_factor)
    # 1000円単位に丸める
    return (price // 1000) * 1000


def generate_mock_prices(
    comp_hotels: list[dict],
    start_date: date,
    days: int = 30,
) -> list[MockPrice]:
    """
    comp_hotels: [{"name": str, "base_price": int, "variance": float}, ...]
    """
    results: list[MockPrice] = []
    for i, hotel in enumerate(comp_hotels):
        base = hotel.get("base_price", 15000)
        variance = hotel.get("variance", 0.15)
        name = hotel["name"]
        for day in range(days):
            target = start_date + timedelta(days=day)
            price = _mock_price_for(base, variance, target, seed_offset=i * 1000)
            rooms = random.Random(target.toordinal() + i).randint(2, 20)
            results.append(MockPrice(
                competitor_name=name,
                target_date=target.isoformat(),
                price=price,
                available_rooms=rooms,
                source_url=f"https://www.expedia.co.jp/mock/{name}/{target}",
            ))
    return results

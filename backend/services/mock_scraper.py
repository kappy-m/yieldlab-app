"""
モックスクレイパー: 実Expedia接続なしで競合価格データを生成する。

ホテル名からRoyal Park Hotelチェーン等の価格帯を自動判別し、
よりリアルな競合価格データを生成する。

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


# ホテル名パターン → 価格設定マッピング
# Royal Park Hotels チェーン + 主要都市ホテル
HOTEL_PRICE_CATALOG: list[dict] = [
    # ===== Royal Park Hotels チェーン =====
    {
        "pattern": "ロイヤルパークホテル 東京日本橋",
        "base_price": 27000,
        "variance": 0.22,
        "category": "luxury",
    },
    {
        "pattern": "ザ ロイヤルパーク ホテル 銀座",
        "base_price": 23000,
        "variance": 0.20,
        "category": "upscale",
    },
    {
        "pattern": "ザ ロイヤルパーク ホテル 東京羽田",
        "base_price": 32000,
        "variance": 0.25,
        "category": "luxury",
    },
    {
        "pattern": "ロイヤルパーク キャンバス 渋谷",
        "base_price": 20000,
        "variance": 0.18,
        "category": "upscale",
    },
    {
        "pattern": "ロイヤルパーク キャンバス 大手町",
        "base_price": 22000,
        "variance": 0.20,
        "category": "upscale",
    },
    {
        "pattern": "ロイヤルパーク キャンバス",
        "base_price": 19000,
        "variance": 0.18,
        "category": "upscale",
    },
    {
        "pattern": "ロイヤルパークホテル",
        "base_price": 25000,
        "variance": 0.22,
        "category": "luxury",
    },
    # ===== 日本橋・丸の内エリア競合ホテル（Royal Park Hotel Nihonbashi 競合セット）=====
    {
        "pattern": "パレスホテル東京",
        "base_price": 72000,
        "variance": 0.28,
        "category": "ultra-luxury",
    },
    {
        "pattern": "マンダリン オリエンタル",
        "base_price": 85000,
        "variance": 0.30,
        "category": "ultra-luxury",
    },
    {
        "pattern": "コンラッド東京",
        "base_price": 55000,
        "variance": 0.28,
        "category": "luxury",
    },
    {
        "pattern": "シャングリ・ラ 東京",
        "base_price": 68000,
        "variance": 0.30,
        "category": "ultra-luxury",
    },
    {
        "pattern": "ペニンシュラ東京",
        "base_price": 90000,
        "variance": 0.32,
        "category": "ultra-luxury",
    },
    # ===== 渋谷エリア競合ホテル（参考） =====
    {
        "pattern": "セルリアンタワー東急",
        "base_price": 35000,
        "variance": 0.25,
        "category": "luxury",
    },
    {
        "pattern": "渋谷エクセルホテル東急",
        "base_price": 22000,
        "variance": 0.20,
        "category": "upscale",
    },
    {
        "pattern": "渋谷グランベル",
        "base_price": 18000,
        "variance": 0.18,
        "category": "midscale",
    },
    {
        "pattern": "ヒルトン東京",
        "base_price": 38000,
        "variance": 0.28,
        "category": "luxury",
    },
    {
        "pattern": "パークハイアット",
        "base_price": 65000,
        "variance": 0.30,
        "category": "ultra-luxury",
    },
]

# フォールバック（名前マッチなし）
DEFAULT_PRICE_CONFIG = {"base_price": 18000, "variance": 0.18, "category": "midscale"}

# デフォルト競合ホテルリスト（Comp Set未設定時）
DEFAULT_COMP_HOTELS = [
    {"name": "ロイヤルパークホテル 東京日本橋", "base_price": 27000, "variance": 0.22},
    {"name": "ザ ロイヤルパーク ホテル 銀座6丁目", "base_price": 23000, "variance": 0.20},
    {"name": "ロイヤルパーク キャンバス 渋谷桜丘", "base_price": 20000, "variance": 0.18},
    {"name": "セルリアンタワー東急ホテル", "base_price": 35000, "variance": 0.25},
    {"name": "渋谷エクセルホテル東急", "base_price": 22000, "variance": 0.20},
]


def _get_price_config(hotel_name: str) -> dict:
    """ホテル名からカタログの価格設定を返す（部分マッチ）"""
    for catalog in HOTEL_PRICE_CATALOG:
        if catalog["pattern"] in hotel_name:
            return catalog
    return DEFAULT_PRICE_CONFIG


def _mock_price_for(base: int, variance: float, target: date, seed_offset: int = 0) -> int:
    """日付とシードに基づいて再現性のある価格を生成"""
    seed = target.toordinal() + seed_offset
    rng = random.Random(seed)

    # 曜日プレミアム
    weekday = target.weekday()
    if weekday in (4, 5):   # 金土
        dow_factor = 1.18
    elif weekday == 6:       # 日
        dow_factor = 1.08
    elif weekday == 0:       # 月
        dow_factor = 0.95
    else:
        dow_factor = 1.0

    # 季節性（春・夏・年末ピーク）
    month = target.month
    if month in (3, 4):      # 春（花見・年度替わり）
        season_factor = 1.12
    elif month in (7, 8):    # 夏
        season_factor = 1.10
    elif month in (12,):     # 年末
        season_factor = 1.15
    elif month == 1:         # 正月明け閑散
        season_factor = 0.88
    elif month in (2, 6):    # 梅雨・閑散
        season_factor = 0.92
    else:
        season_factor = 1.0

    # 先読み期間プレミアム（直前は価格が動く）
    days_ahead = max(0, (target - date.today()).days)
    if days_ahead <= 3:
        urgency_factor = 1.08 if rng.random() > 0.4 else 0.85  # 直前は上下どちらも
    elif days_ahead <= 7:
        urgency_factor = 1.04
    else:
        urgency_factor = 1.0

    # ランダム揺らぎ
    rand_factor = 1.0 + rng.uniform(-variance, variance)

    price = int(base * dow_factor * season_factor * urgency_factor * rand_factor)
    return (price // 1000) * 1000


def generate_mock_prices(
    comp_hotels: list[dict],
    start_date: date,
    days: int = 30,
) -> list[MockPrice]:
    """
    comp_hotels: [{"name": str, "base_price"?: int, "variance"?: float}, ...]
    ホテル名から自動的に価格カタログを参照する
    """
    results: list[MockPrice] = []
    for i, hotel in enumerate(comp_hotels):
        name = hotel["name"]

        # 引数で指定があればそちらを優先、なければカタログから取得
        catalog = _get_price_config(name)
        base = hotel.get("base_price") or catalog["base_price"]
        variance = hotel.get("variance") or catalog["variance"]

        for day in range(days):
            target = start_date + timedelta(days=day)
            price = _mock_price_for(base, variance, target, seed_offset=i * 1000)
            rooms = random.Random(target.toordinal() + i).randint(2, 15)
            results.append(MockPrice(
                competitor_name=name,
                target_date=target.isoformat(),
                price=price,
                available_rooms=rooms,
                source_url=f"https://www.expedia.co.jp/Tokyo-Hotels-{name}.h{i+1}.Hotel-Information",
            ))
    return results

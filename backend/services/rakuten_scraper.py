"""
楽天トラベル 公式API ベース競合価格スクレイパー

楽天ウェブサービス VacantHotelSearch API v2017-04-26 を使用。

取得価格: dailyCharge.total (2名1室・税込 日別最安値)
  - chargeFlag=0: 1人あたり料金 → total = rakutenCharge × 人数
  - chargeFlag=1: 1室あたり料金 → total = rakutenCharge
  → total フィールドが常に「2名1室 合計」を示す

取得効率: 1日付 × 1リクエストで最大15ホテル同時取得
  90日分: 90 requests × 1 sec = 約90秒

設定（環境変数）:
  RAKUTEN_APP_ID     : アプリケーションID (UUID形式)
  RAKUTEN_ACCESS_KEY : アクセスキー (pk_xxx 形式)

競合ホテルの楽天 hotelNo:
  パレスホテル東京           184685  ✅
  ザ・ペニンシュラ東京       184598  ✅
  コンラッド東京             78151   ✅
  マンダリン オリエンタル東京  (楽天非掲載 → mockフォールバック)
  シャングリ・ラ 東京         (楽天非掲載 → mockフォールバック)
"""

import asyncio
import logging
import os
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

RAKUTEN_API_ENDPOINT = (
    "https://openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426"
)


@dataclass
class RakutenPrice:
    competitor_name: str
    target_date: str       # YYYY-MM-DD
    price: int             # 2名1室・税込の日別最安値（dailyCharge.total）
    available_rooms: Optional[int]
    source_url: str


def _get_credentials() -> tuple[str, str]:
    app_id     = os.environ.get("RAKUTEN_APP_ID", "")
    access_key = os.environ.get("RAKUTEN_ACCESS_KEY", "")
    if not app_id or not access_key:
        raise EnvironmentError(
            "RAKUTEN_APP_ID / RAKUTEN_ACCESS_KEY が未設定です。.env に追記してください。"
        )
    return app_id, access_key


def _parse_hotels(raw_hotels: list) -> dict[int, int]:
    """
    APIレスポンスを解析し {hotelNo: min_room_price} を返す。

    価格優先順位:
      1. dailyCharge.total  ← 2名1室合計（最も正確）
      2. hotelMinCharge     ← フォールバック（全体最安値・日付非依存）

    formatVersion=2 の構造:
      hotels[i] = [
        {"hotelBasicInfo": {...}},
        {"roomInfo": [
          {"roomBasicInfo": {...}, "dailyCharge": {"total": int, ...}},
          ...
        ]}
      ]
    """
    result: dict[int, int] = {}

    for hotel_list in raw_hotels:
        if not isinstance(hotel_list, list):
            continue

        info: dict = {}
        room_info_list: list = []

        for item in hotel_list:
            if not isinstance(item, dict):
                continue
            if "hotelBasicInfo" in item:
                info = item["hotelBasicInfo"]
            if "roomInfo" in item:
                room_info_list = item["roomInfo"]

        hotel_no = info.get("hotelNo")
        if not hotel_no:
            continue

        # dailyCharge.total から最安値を取得
        best_total: Optional[int] = None
        for ri in room_info_list:
            if not isinstance(ri, dict):
                continue
            dc    = ri.get("dailyCharge", {})
            total = dc.get("total")
            if total and total > 0:
                if best_total is None or total < best_total:
                    best_total = total

        if best_total:
            result[hotel_no] = best_total
        elif info.get("hotelMinCharge"):
            # フォールバック: hotelMinCharge（日付非依存だが最低限の値）
            result[hotel_no] = info["hotelMinCharge"]

    return result


async def fetch_rakuten_prices_batch(
    hotel_nos: list[str],
    check_in: str,
) -> dict[str, int]:
    """
    複数ホテルを1リクエストで取得。{hotelNo_str: room_price} を返す。
    最大15ホテル同時取得可能。
    """
    try:
        import httpx
    except ImportError:
        raise ImportError("pip install httpx が必要です")

    app_id, access_key = _get_credentials()

    ci = date.fromisoformat(check_in)
    co = ci + timedelta(days=1)

    params = {
        "applicationId": app_id,
        "accessKey":     access_key,
        "hotelNo":       ",".join(hotel_nos),
        "checkinDate":   check_in,
        "checkoutDate":  co.isoformat(),
        "adultNum":      "2",
        "roomNum":       "1",
        "format":        "json",
        "formatVersion": "2",
        "responseType":  "large",   # dailyCharge.total を取得するために必要
        "sort":          "+roomCharge",
        "hits":          "3",       # 最安3プランのみ（効率化）
    }
    headers = {"Authorization": f"Bearer {access_key}"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(RAKUTEN_API_ENDPOINT, params=params, headers=headers)

    if resp.status_code == 404:
        logger.info(f"[Rakuten API] 空室なし: {check_in}")
        return {}

    resp.raise_for_status()
    data = resp.json()
    prices = _parse_hotels(data.get("hotels", []))
    return {str(no): price for no, price in prices.items()}


async def scrape_rakuten_comp_set(
    comp_hotels: list[dict],    # [{"name": str, "rakuten_no": str}, ...]
    check_in_dates: list[str],
    rate_limit_seconds: float = 1.0,
) -> list[RakutenPrice]:
    """
    複数ホテル・複数日付の楽天トラベル価格を取得。
    1日付 = 1リクエスト（全ホテルをバッチ取得）。
    """
    active = [h for h in comp_hotels if h.get("rakuten_no")]
    if not active:
        logger.warning("[Rakuten API] rakuten_no が設定されたホテルがありません")
        return []

    hotel_no_list = [h["rakuten_no"] for h in active]
    name_by_no    = {h["rakuten_no"]: h["name"] for h in active}

    results: list[RakutenPrice] = []
    errors = 0

    for check_in in check_in_dates:
        try:
            prices = await fetch_rakuten_prices_batch(hotel_no_list, check_in)
            for no, price in prices.items():
                name = name_by_no.get(no, f"hotelNo={no}")
                results.append(RakutenPrice(
                    competitor_name=name,
                    target_date=check_in,
                    price=price,
                    available_rooms=None,
                    source_url=f"rakuten_api://VacantHotelSearch/{no}/{check_in}",
                ))
        except Exception as e:
            errors += 1
            logger.error(f"[Rakuten API] エラー {check_in}: {e}")
            if errors >= 5:
                logger.error("[Rakuten API] エラーが多すぎます。処理を中断します。")
                break

        await asyncio.sleep(rate_limit_seconds)

    logger.info(
        f"[Rakuten API] 完了: {len(results)}件取得 "
        f"({len(active)}ホテル × {len(check_in_dates)}日, エラー={errors})"
    )
    return results

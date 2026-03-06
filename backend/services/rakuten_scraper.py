"""
楽天トラベル空室検索API (VacantHotelSearch v2017-04-26) ベース競合価格スクレイパー

■ API仕様サマリー (https://webservice.rakuten.co.jp/documentation/vacant-hotel-search)

取得価格: dailyCharge.total (2名1室・税込 日別最安値)
  - chargeFlag=0: 1人あたり料金 → total = rakutenCharge × 人数
  - chargeFlag=1: 1室あたり料金 → total = rakutenCharge
  → total フィールドが常に「2名1室 合計」を示す

在庫代理指標: hotelReserveInfo.reserveRecordCount
  - 予約可能なプラン×部屋の組み合わせ総件数（実際の残室数ではない）
  - 多い → 在庫潤沢（需要低 or まだ売り込み中）
  - 少ない → 逼迫（人気日程 / 高稼働）
  - ホテルが返却されない → 実質満室 or 楽天非掲載
  ※ lowestCharge / highestCharge は廃止済み（常に0）で使用不可

取得効率: 1日付 × 1リクエストで最大15ホテル同時取得
  90日分: 90 requests × 1 sec = 約90秒

設定（環境変数）:
  RAKUTEN_APP_ID     : アプリケーションID (UUID形式)
  RAKUTEN_ACCESS_KEY : アクセスキー (pk_xxx 形式)
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


def _parse_hotels(raw_hotels: list) -> dict[int, dict]:
    """
    APIレスポンスを解析し {hotelNo: {"price": int, "reserve_record_count": int}} を返す。

    価格優先順位:
      1. dailyCharge.total (roomBasicInfo内) ← 2名1室合計・日付依存で最も正確
      2. hotelMinCharge (hotelBasicInfo内)   ← 日付非依存フォールバック

    在庫代理指標: hotelReserveInfo.reserveRecordCount
      - API仕様の正式フィールド（hits制限に関係なく総件数を返す）
      - len(roomInfo) は hits=3 で最大3になるため使用不可
      - 多い → 在庫潤沢、少ない → 逼迫、ホテル未返却 → 実質満室

    formatVersion=2 の応答構造:
      hotels[i] = [
        {"hotelBasicInfo": {"hotelNo": ..., "hotelMinCharge": ..., ...}},
        {"hotelDetailInfo": {...}},          # responseType=middle/large のみ
        {"hotelReserveInfo": {"reserveRecordCount": int, ...}},
        {"roomInfo": [
          {"roomBasicInfo": {...}, "dailyCharge": {"total": int, ...}},
          ...
        ]}
      ]
    """
    result: dict[int, dict] = {}

    for hotel_list in raw_hotels:
        if not isinstance(hotel_list, list):
            continue

        info: dict = {}
        reserve_info: dict = {}
        room_info_list: list = []

        for item in hotel_list:
            if not isinstance(item, dict):
                continue
            if "hotelBasicInfo" in item:
                info = item["hotelBasicInfo"]
            if "hotelReserveInfo" in item:
                reserve_info = item["hotelReserveInfo"]
            if "roomInfo" in item:
                room_info_list = item["roomInfo"]

        hotel_no = info.get("hotelNo")
        if not hotel_no:
            continue

        # ① dailyCharge.total から日付依存の最安値を取得（最優先）
        best_total: Optional[int] = None
        for ri in room_info_list:
            if not isinstance(ri, dict):
                continue
            dc    = ri.get("dailyCharge", {})
            total = dc.get("total")
            if total and total > 0:
                if best_total is None or total < best_total:
                    best_total = total

        # ② hotelMinCharge をフォールバック
        price = best_total or info.get("hotelMinCharge")
        if not price:
            continue

        # ③ reserveRecordCount = 予約候補の総件数（在庫代理指標）
        # hits=3 の影響を受けず、全プラン数を正確に反映する
        reserve_record_count = reserve_info.get("reserveRecordCount")

        result[hotel_no] = {
            "price": price,
            "reserve_record_count": reserve_record_count,  # None の場合はAPIがmiddleレスポンス未返却
        }

    return result


async def fetch_rakuten_prices_batch(
    hotel_nos: list[str],
    check_in: str,
) -> dict[str, dict]:
    """
    複数ホテルを1リクエストで取得。{hotelNo_str: {"price": int, "plans_available": int}} を返す。
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
        # middle: hotelReserveInfo(reserveRecordCount) + roomInfo(dailyCharge) が取得可能
        # large と同等の在庫情報だが、不要フィールドが少なくレスポンスが軽い
        "responseType":  "middle",
        "sort":          "+roomCharge",  # 最安順
        "hits":          "3",            # 最安3プランのみ取得（価格取得目的なので十分）
        # ※ hits=3 でも reserveRecordCount は全件数を正確に返す（仕様確認済み）
    }
    headers = {"Authorization": f"Bearer {access_key}"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(RAKUTEN_API_ENDPOINT, params=params, headers=headers)

    if resp.status_code == 404:
        logger.info(f"[Rakuten API] 空室なし: {check_in}")
        return {}

    resp.raise_for_status()
    data = resp.json()
    parsed = _parse_hotels(data.get("hotels", []))
    logger.debug(f"[Rakuten API] {check_in}: {len(parsed)}ホテル取得 "
                 f"reserve_record_counts={[v.get('reserve_record_count') for v in parsed.values()]}")
    return {str(no): hotel_info for no, hotel_info in parsed.items()}


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
            hotel_data = await fetch_rakuten_prices_batch(hotel_no_list, check_in)
            for no, info in hotel_data.items():
                name = name_by_no.get(no, f"hotelNo={no}")
                results.append(RakutenPrice(
                    competitor_name=name,
                    target_date=check_in,
                    price=info["price"],
                    available_rooms=info.get("reserve_record_count"),  # 予約候補総件数（仕様書#36フィールド）
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

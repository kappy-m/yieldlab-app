"""
楽天トラベル施設情報API (HotelDetailSearch v2017-04-26) を使った評価データ取得

取得フィールド:
  hotelBasicInfo.reviewAverage   : 総合評価（★）
  hotelBasicInfo.reviewCount     : 口コミ件数
  hotelRatingInfo.serviceAverage : サービス
  hotelRatingInfo.locationAverage: 立地
  hotelRatingInfo.roomAverage    : 部屋
  hotelRatingInfo.equipmentAverage: 設備・アメニティ
  hotelRatingInfo.bathAverage    : 風呂
  hotelRatingInfo.mealAverage    : 食事

responseType=middle で hotelRatingInfo まで取得可能。
"""

import asyncio
import logging
import os
import re
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

RAKUTEN_DETAIL_ENDPOINT = (
    "https://openapi.rakuten.co.jp/engine/api/Travel/HotelDetailSearch/20170426"
)

_RETRY_DELAYS = [3, 6, 12]  # 指数バックオフ（秒）


_HTML_TAG_RE  = re.compile(r"<[^>]+>")
_DATE_RE      = re.compile(r"\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}")
_URL_RE       = re.compile(r"https?://[^\s\u3000　]+")
_CONTINUATION = re.compile(r"(クチコミの詳細はこちらから|つづきはこちら|続きはこちら|詳細はこちら)[^\n]*$", re.MULTILINE)


def _clean_review(raw: str) -> tuple[str, str | None]:
    """楽天 userReview からHTMLタグ・URL・日付を除去し (clean_text, date_str) を返す"""
    # HTML タグ削除
    text = _HTML_TAG_RE.sub("", raw)
    # 日付を抽出（除去前に取得）
    date_match = _DATE_RE.search(text)
    date_str = date_match.group(0).strip() if date_match else None
    # 日付文字列を除去（前後の「投稿」も含む）
    text = re.sub(r"\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*投稿?", "", text)
    # 「クチコミの詳細はこちらから」以降を除去
    text = _CONTINUATION.sub("", text)
    # URL を除去
    text = _URL_RE.sub("", text)
    # 余分な空白・全角スペース・改行を整形
    text = re.sub(r"[\u3000　]+", " ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text, date_str


@dataclass
class HotelRatingData:
    rakuten_no: str
    overall: float | None
    review_count: int | None
    service: float | None
    location: float | None
    room: float | None
    equipment: float | None
    bath: float | None
    meal: float | None
    user_review: str | None = None   # お客さまの声（最新1件・HTMLタグ除去済み）
    review_url: str | None = None    # 楽天レビューページURL
    review_date: str | None = None   # 投稿日 (YYYY-MM-DD HH:MM:SS)


async def fetch_hotel_rating(
    rakuten_no: str,
    client: httpx.AsyncClient,
    app_id: str,
    access_key: str,
) -> HotelRatingData | None:
    """単一ホテルの評価データを取得する。失敗時は None を返す。"""
    params = {
        "applicationId": app_id,
        "accessKey": access_key,
        "hotelNo": rakuten_no,
        "responseType": "large",   # カテゴリ別評価(hotelRatingInfo)を取得するにはlargeが必要
        "formatVersion": "2",
        "format": "json",
    }

    for attempt, delay in enumerate([0] + _RETRY_DELAYS, start=1):
        if delay:
            await asyncio.sleep(delay)
        try:
            resp = await client.get(
                RAKUTEN_DETAIL_ENDPOINT,
                params=params,
                timeout=15.0,
            )

            if resp.status_code == 429:
                logger.warning("HotelDetailSearch 429: hotelNo=%s attempt=%d", rakuten_no, attempt)
                if attempt <= len(_RETRY_DELAYS):
                    continue
                return None

            if resp.status_code == 404:
                logger.info("HotelDetailSearch 404 (not listed): hotelNo=%s", rakuten_no)
                return None

            if resp.status_code >= 500:
                logger.warning("HotelDetailSearch 5xx=%d: hotelNo=%s attempt=%d",
                               resp.status_code, rakuten_no, attempt)
                if attempt <= len(_RETRY_DELAYS):
                    continue
                return None

            if resp.status_code != 200:
                logger.error("HotelDetailSearch error=%d hotelNo=%s", resp.status_code, rakuten_no)
                return None

            data = resp.json()

            # formatVersion=2 のレスポンス構造:
            #   {"hotels": [[{"hotelBasicInfo": {...}}, {"hotelRatingInfo": {...}}]]}
            # hotels[0] が直接ブロックのリスト（formatVersion=1 の "hotel" ラッパーなし）
            hotels = data.get("hotels", [])
            if not hotels:
                return None

            # hotels[0] がリストならそのまま使用、dictなら"hotel"キーで取得（v1互換）
            first = hotels[0]
            hotel_blocks: list = first if isinstance(first, list) else first.get("hotel", [])

            basic_info: dict = {}
            rating_info: dict = {}
            for block in hotel_blocks:
                if "hotelBasicInfo" in block:
                    basic_info = block["hotelBasicInfo"]
                if "hotelRatingInfo" in block:
                    rating_info = block["hotelRatingInfo"]

            def _safe_float(v) -> float | None:
                try:
                    f = float(v)
                    return f if f > 0 else None
                except (TypeError, ValueError):
                    return None

            def _safe_int(v) -> int | None:
                try:
                    return int(v)
                except (TypeError, ValueError):
                    return None

            # お客さまの声（最新1件）- HTMLタグ除去・日付抽出
            raw_review = basic_info.get("userReview") or ""
            if raw_review:
                clean_text, review_date = _clean_review(raw_review)
                user_review = clean_text[:1500] if clean_text else None
            else:
                user_review, review_date = None, None

            # レビューページURL（楽天トラベルの正式クチコミページ）
            review_page_url = f"https://travel.rakuten.co.jp/HOTEL/{rakuten_no}/review.html"

            return HotelRatingData(
                rakuten_no=rakuten_no,
                overall=_safe_float(basic_info.get("reviewAverage")),
                review_count=_safe_int(basic_info.get("reviewCount")),
                service=_safe_float(rating_info.get("serviceAverage")),
                location=_safe_float(rating_info.get("locationAverage")),
                room=_safe_float(rating_info.get("roomAverage")),
                equipment=_safe_float(rating_info.get("equipmentAverage")),
                bath=_safe_float(rating_info.get("bathAverage")),
                meal=_safe_float(rating_info.get("mealAverage")),
                user_review=user_review,
                review_url=review_page_url,
                review_date=review_date,
            )

        except httpx.TimeoutException:
            logger.warning("HotelDetailSearch timeout: hotelNo=%s attempt=%d", rakuten_no, attempt)
            if attempt <= len(_RETRY_DELAYS):
                continue
            return None
        except Exception as e:
            logger.exception("HotelDetailSearch unexpected error: hotelNo=%s: %s", rakuten_no, e)
            return None

    return None


async def fetch_ratings_for_property(
    comp_set: list[dict],  # [{"name": str, "rakuten_hotel_no": str}]
) -> list[HotelRatingData]:
    """競合セット全体の評価を並列取得する（レート制限を考慮して同時3件）"""
    app_id = os.environ.get("RAKUTEN_APP_ID", "")
    access_key = os.environ.get("RAKUTEN_ACCESS_KEY", "")
    if not app_id or not access_key:
        logger.warning("RAKUTEN_APP_ID / RAKUTEN_ACCESS_KEY が未設定です")
        return []

    semaphore = asyncio.Semaphore(3)  # 同時3件に制限

    async def _guarded_fetch(item: dict, client: httpx.AsyncClient) -> HotelRatingData | None:
        rakuten_no = item.get("rakuten_hotel_no", "")
        if not rakuten_no:
            return None
        async with semaphore:
            result = await fetch_hotel_rating(rakuten_no, client, app_id, access_key)
            if result:
                # 後でホテル名紐付けができるよう rakuten_no は既にセット済み
                return result
            return None

    async with httpx.AsyncClient() as client:
        tasks = [_guarded_fetch(item, client) for item in comp_set]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    return [r for r in results if isinstance(r, HotelRatingData)]

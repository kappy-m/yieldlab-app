"""
Google Places API (New) を使ったホテル評価・口コミ取得

使用エンドポイント:
  POST https://places.googleapis.com/v1/places:searchText   → place_id 検索
  GET  https://places.googleapis.com/v1/places/{place_id}   → 評価・口コミ取得

必要な環境変数:
  GOOGLE_PLACES_API_KEY

スコープ:
  - rating          (float, 1.0-5.0 → 5.0スケールに変換不要)
  - userRatingCount (int)
  - reviews[0]      (最新1件: text, rating, publishTime)
"""

import asyncio
import logging
import os
import re
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

PLACES_SEARCH_URL  = "https://places.googleapis.com/v1/places:searchText"
PLACES_DETAIL_URL  = "https://places.googleapis.com/v1/places/{place_id}"

_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")


@dataclass
class GoogleRatingData:
    place_id: str
    overall: float | None           # 1.0-5.0
    review_count: int | None
    user_review: str | None         # 最新口コミ1件
    review_date: str | None         # YYYY-MM-DD
    review_url: str | None = None   # Google Maps ページ URL


async def search_place_id(
    hotel_name: str,
    client: httpx.AsyncClient,
    api_key: str,
) -> str | None:
    """ホテル名で Google Place ID を検索して返す。見つからなければ None。"""
    try:
        resp = await client.post(
            PLACES_SEARCH_URL,
            json={
                "textQuery": hotel_name,
                "languageCode": "ja",
                "maxResultCount": 1,
                "includedType": "lodging",
            },
            headers={
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": "places.id,places.displayName,places.rating",
                "Content-Type": "application/json",
            },
            timeout=10.0,
        )
        if resp.status_code == 200:
            places = resp.json().get("places", [])
            if places:
                return places[0].get("id")
        else:
            logger.warning("Google Places searchText status=%d hotel=%s", resp.status_code, hotel_name)
    except Exception as e:
        logger.error("Google Places searchText error: %s: %s", hotel_name, e)
    return None


async def fetch_google_rating(
    place_id: str,
    client: httpx.AsyncClient,
    api_key: str,
) -> GoogleRatingData | None:
    """Place ID からホテルの評価・口コミを取得する。"""
    field_mask = "id,rating,userRatingCount,googleMapsUri,reviews"
    try:
        resp = await client.get(
            PLACES_DETAIL_URL.format(place_id=place_id),
            params={"languageCode": "ja"},
            headers={
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": field_mask,
            },
            timeout=12.0,
        )
        if resp.status_code != 200:
            logger.warning("Google Places detail status=%d place_id=%s", resp.status_code, place_id)
            return None

        data = resp.json()
        rating = data.get("rating")
        review_count = data.get("userRatingCount")
        maps_uri = data.get("googleMapsUri")

        # 最新口コミ (日本語優先、なければ最初の1件)
        reviews = data.get("reviews", [])
        best_review = None
        for r in reviews:
            lang = (r.get("text") or {}).get("languageCode", "")
            if lang == "ja":
                best_review = r
                break
        if not best_review and reviews:
            best_review = reviews[0]

        user_review = None
        review_date = None
        if best_review:
            text_obj = best_review.get("text") or best_review.get("originalText") or {}
            user_review = text_obj.get("text", "")[:1000] or None
            publish_time = best_review.get("publishTime", "")
            if publish_time:
                m = _DATE_RE.match(publish_time)
                review_date = m.group(0) if m else None

        return GoogleRatingData(
            place_id=place_id,
            overall=float(rating) if rating is not None else None,
            review_count=int(review_count) if review_count is not None else None,
            user_review=user_review,
            review_date=review_date,
            review_url=maps_uri,
        )
    except Exception as e:
        logger.error("Google Places detail error: place_id=%s: %s", place_id, e)
        return None


async def fetch_google_ratings_for_property(
    comp_list: list[dict],  # [{"name": str, "google_place_id": str | None}]
) -> list[tuple[str, GoogleRatingData]]:
    """
    競合セット全体のGoogle評価を取得する。
    返り値: [(hotel_name, GoogleRatingData), ...]
    google_place_id がない場合はテキスト検索で自動取得し直す。
    """
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY", "")
    if not api_key:
        logger.info("GOOGLE_PLACES_API_KEY 未設定のためGoogle評価取得をスキップ")
        return []

    semaphore = asyncio.Semaphore(3)
    results: list[tuple[str, GoogleRatingData]] = []

    async def _fetch_one(item: dict, client: httpx.AsyncClient):
        name = item["name"]
        place_id = item.get("google_place_id") or None

        async with semaphore:
            # place_id が未設定なら自動検索
            if not place_id:
                place_id = await search_place_id(name, client, api_key)
                if place_id:
                    item["_resolved_place_id"] = place_id
                    logger.info("Google Place ID resolved: %s → %s", name, place_id)

            if not place_id:
                logger.info("Google Place ID not found: %s", name)
                return

            data = await fetch_google_rating(place_id, client, api_key)
            if data:
                results.append((name, data))

    async with httpx.AsyncClient() as client:
        await asyncio.gather(*[_fetch_one(item, client) for item in comp_list])

    return results

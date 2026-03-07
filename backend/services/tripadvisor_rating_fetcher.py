"""
TripAdvisor Content API v3 を使ったホテル評価・口コミ取得

使用エンドポイント:
  GET https://api.content.tripadvisor.com/api/v1/location/search   → location_id 検索
  GET https://api.content.tripadvisor.com/api/v1/location/{id}/details → 評価情報
  GET https://api.content.tripadvisor.com/api/v1/location/{id}/reviews → 口コミ取得

必要な環境変数:
  TRIPADVISOR_API_KEY

スコープ:
  - rating             (float, 1.0-5.0)
  - num_reviews        (int)
  - data[0] from reviews: text, rating, published_date
"""

import asyncio
import logging
import os
import re
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://api.content.tripadvisor.com/api/v1/location"

_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")


@dataclass
class TripAdvisorRatingData:
    location_id: str
    overall: float | None           # 1.0-5.0 (TripAdvisorは0.5刻み)
    review_count: int | None
    user_review: str | None         # 最新口コミ
    review_date: str | None         # YYYY-MM-DD
    review_url: str | None = None   # TripAdvisor ページ URL


async def search_location_id(
    hotel_name: str,
    client: httpx.AsyncClient,
    api_key: str,
) -> str | None:
    """ホテル名で TripAdvisor Location ID を検索して返す。"""
    try:
        resp = await client.get(
            f"{BASE_URL}/search",
            params={
                "key": api_key,
                "searchQuery": hotel_name,
                "category": "hotels",
                "language": "ja",
            },
            timeout=10.0,
        )
        if resp.status_code == 200:
            data = resp.json().get("data", [])
            if data:
                return str(data[0]["location_id"])
        else:
            logger.warning("TripAdvisor search status=%d hotel=%s body=%s",
                           resp.status_code, hotel_name, resp.text[:200])
    except Exception as e:
        logger.error("TripAdvisor search error: %s: %s", hotel_name, e)
    return None


async def fetch_tripadvisor_rating(
    location_id: str,
    client: httpx.AsyncClient,
    api_key: str,
) -> TripAdvisorRatingData | None:
    """Location ID からホテルの評価・口コミを取得する。"""
    common_params = {"key": api_key, "language": "ja"}

    try:
        # 詳細情報（評価・口コミ件数）
        detail_resp = await client.get(
            f"{BASE_URL}/{location_id}/details",
            params={**common_params, "currency": "JPY"},
            timeout=12.0,
        )
        if detail_resp.status_code != 200:
            logger.warning("TripAdvisor details status=%d loc=%s", detail_resp.status_code, location_id)
            return None

        detail = detail_resp.json()
        rating_str = detail.get("rating")
        num_reviews = detail.get("num_reviews")
        web_url = detail.get("web_url")

        overall = float(rating_str) if rating_str else None
        review_count = int(num_reviews) if num_reviews else None

        # 最新口コミ（1件）
        review_resp = await client.get(
            f"{BASE_URL}/{location_id}/reviews",
            params={**common_params, "limit": 3},
            timeout=12.0,
        )
        user_review = None
        review_date = None
        if review_resp.status_code == 200:
            reviews = review_resp.json().get("data", [])
            if reviews:
                r = reviews[0]
                user_review = (r.get("text") or "")[:1000] or None
                published = r.get("published_date", "")
                if published:
                    m = _DATE_RE.match(published)
                    review_date = m.group(0) if m else None

        return TripAdvisorRatingData(
            location_id=location_id,
            overall=overall,
            review_count=review_count,
            user_review=user_review,
            review_date=review_date,
            review_url=web_url,
        )
    except Exception as e:
        logger.error("TripAdvisor fetch error: location_id=%s: %s", location_id, e)
        return None


async def fetch_tripadvisor_ratings_for_property(
    comp_list: list[dict],  # [{"name": str, "tripadvisor_location_id": str | None}]
) -> list[tuple[str, TripAdvisorRatingData]]:
    """
    競合セット全体の TripAdvisor 評価を取得する。
    返り値: [(hotel_name, TripAdvisorRatingData), ...]
    """
    api_key = os.environ.get("TRIPADVISOR_API_KEY", "")
    if not api_key:
        logger.info("TRIPADVISOR_API_KEY 未設定のためTripAdvisor評価取得をスキップ")
        return []

    semaphore = asyncio.Semaphore(2)  # TripAdvisorは秒5req上限
    results: list[tuple[str, TripAdvisorRatingData]] = []

    async def _fetch_one(item: dict, client: httpx.AsyncClient):
        name = item["name"]
        location_id = item.get("tripadvisor_location_id") or None

        async with semaphore:
            if not location_id:
                location_id = await search_location_id(name, client, api_key)
                if location_id:
                    item["_resolved_location_id"] = location_id
                    logger.info("TripAdvisor location_id resolved: %s → %s", name, location_id)

            if not location_id:
                logger.info("TripAdvisor location not found: %s", name)
                return

            data = await fetch_tripadvisor_rating(location_id, client, api_key)
            if data:
                results.append((name, data))
            await asyncio.sleep(0.3)  # レート制限配慮

    async with httpx.AsyncClient() as client:
        await asyncio.gather(*[_fetch_one(item, client) for item in comp_list])

    return results

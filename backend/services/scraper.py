"""
Expedia 競合価格スクレイパー

スクレイプ戦略（フォールバック順）:
  1. httpx による軽量 HTTP フェッチ（高速・Expedia API エンドポイント狙い）
  2. Playwright による JS レンダリング（ブラウザ完全実行）

scrape_mode = "live" のホテルに適用される。
"""

import asyncio
import re
import json
import logging
from datetime import date, timedelta
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class ScrapedPrice:
    competitor_name: str
    target_date: str      # YYYY-MM-DD
    price: int            # 円
    available_rooms: int | None
    source_url: str


# --- httpx による軽量スクレイプ（Playwright 不要）---

async def _scrape_via_httpx(hotel_name: str, hotel_id: str, check_in: str) -> Optional[int]:
    """
    httpx で Expedia の価格を取得する。
    Expedia の内部 API エンドポイント（/graphql）を利用。
    """
    try:
        import httpx
    except ImportError:
        return None

    ci_date = date.fromisoformat(check_in)
    co_date = ci_date + timedelta(days=1)

    # Expedia Japan の詳細ページ URL
    url = (
        f"https://www.expedia.co.jp/h{hotel_id}.Hotel-Information"
        f"?chkin={ci_date.strftime('%Y-%m-%d')}"
        f"&chkout={co_date.strftime('%Y-%m-%d')}"
        f"&rm1=a2&langid=1041"
    )

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://www.expedia.co.jp/",
    }

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            html = resp.text

            # JSON-LD の価格データを探す
            json_ld_pattern = re.compile(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.DOTALL)
            for match in json_ld_pattern.finditer(html):
                try:
                    data = json.loads(match.group(1))
                    if isinstance(data, dict) and data.get("@type") == "Hotel":
                        offers = data.get("offers", {})
                        if isinstance(offers, dict):
                            price_str = str(offers.get("price", ""))
                            if price_str.replace(".", "").isdigit():
                                return int(float(price_str))
                except (json.JSONDecodeError, ValueError):
                    pass

            # 価格パターンをHTMLから直接抽出（複数セレクター対応）
            price_patterns = [
                r'"price":\s*"?([\d,]+)"?',           # JSON内の price
                r'¥([\d,]+)',                           # 円マーク付き
                r'"lowestPrice":\s*(\d+)',              # lowestPrice
                r'"startingPrice":\s*\{\s*"amount":\s*(\d+)',  # amount
            ]

            for pattern in price_patterns:
                matches = re.findall(pattern, html)
                prices = []
                for m in matches:
                    try:
                        p = int(m.replace(",", ""))
                        if 3000 <= p <= 500000:  # 妥当な価格範囲
                            prices.append(p)
                    except ValueError:
                        pass
                if prices:
                    return min(prices)

    except Exception as e:
        logger.warning(f"[httpx] Failed for {hotel_name} {check_in}: {e}")

    return None


# --- Playwright ブラウザスクレイプ ---

async def _scrape_via_playwright(
    comp_hotels: list[dict],
    check_in_dates: list[str],
) -> list[ScrapedPrice]:
    """Playwright Chromium で Expedia の価格を取得"""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("Playwright がインストールされていません")
        return []

    results: list[ScrapedPrice] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            locale="ja-JP",
            viewport={"width": 1280, "height": 800},
        )

        for hotel in comp_hotels:
            hotel_name = hotel["name"]
            hotel_id = hotel.get("expedia_id", "")
            if not hotel_id:
                continue

            for check_in in check_in_dates:
                ci_date = date.fromisoformat(check_in)
                co_date = ci_date + timedelta(days=1)
                url = (
                    f"https://www.expedia.co.jp/h{hotel_id}.Hotel-Information"
                    f"?chkin={ci_date.strftime('%Y-%m-%d')}"
                    f"&chkout={co_date.strftime('%Y-%m-%d')}"
                    f"&rm1=a2&langid=1041"
                )

                try:
                    page = await context.new_page()
                    await page.goto(url, wait_until="networkidle", timeout=30000)
                    await page.wait_for_timeout(3000)

                    # 複数のセレクターパターンを試みる
                    selectors = [
                        "[data-stid='price-lockup-lead-price']",
                        "[data-stid='content-hotel-lead-price']",
                        ".uitk-price-lockup__price",
                        "[class*='price-lockup'] [class*='price']",
                        "span[class*='price-summary__value']",
                    ]

                    prices: list[int] = []
                    for selector in selectors:
                        try:
                            elements = await page.query_selector_all(selector)
                            for el in elements:
                                text = await el.inner_text()
                                nums = re.findall(r"[\d,]+", text.replace(",", ""))
                                for n in nums:
                                    try:
                                        v = int(n)
                                        if 3000 <= v <= 500000:
                                            prices.append(v)
                                    except ValueError:
                                        pass
                        except Exception:
                            pass
                        if prices:
                            break

                    # JSON-LD フォールバック
                    if not prices:
                        content = await page.content()
                        for pattern in [r'"price":\s*"?([\d,]+)"?', r'¥([\d,]+)']:
                            for m in re.findall(pattern, content):
                                try:
                                    v = int(m.replace(",", ""))
                                    if 3000 <= v <= 500000:
                                        prices.append(v)
                                except ValueError:
                                    pass
                            if prices:
                                break

                    if prices:
                        min_price = min(prices)
                        results.append(ScrapedPrice(
                            competitor_name=hotel_name,
                            target_date=check_in,
                            price=min_price,
                            available_rooms=None,
                            source_url=url,
                        ))
                        logger.info(f"[Playwright] {hotel_name} {check_in}: ¥{min_price:,}")
                    else:
                        logger.warning(f"[Playwright] No price: {hotel_name} {check_in}")

                    await page.close()
                    await asyncio.sleep(2)

                except Exception as e:
                    logger.error(f"[Playwright] Error {hotel_name} {check_in}: {e}")
                    try:
                        await page.close()
                    except Exception:
                        pass

        await browser.close()

    return results


# --- 公開 API ---

async def scrape_expedia_comp_set(
    comp_hotels: list[dict],
    check_in_dates: list[str],
    headless: bool = True,
) -> list[ScrapedPrice]:
    """
    Expedia から競合ホテルの最安値を取得する。

    httpx → Playwright の順でフォールバックする。
    """
    results: list[ScrapedPrice] = []

    for hotel in comp_hotels:
        hotel_name = hotel["name"]
        hotel_id = hotel.get("expedia_id", "")
        if not hotel_id:
            continue

        for check_in in check_in_dates:
            # まず httpx で試みる（高速）
            price = await _scrape_via_httpx(hotel_name, hotel_id, check_in)
            if price:
                ci_date = date.fromisoformat(check_in)
                co_date = ci_date + timedelta(days=1)
                url = (
                    f"https://www.expedia.co.jp/h{hotel_id}.Hotel-Information"
                    f"?chkin={check_in}&chkout={co_date.isoformat()}&rm1=a2&langid=1041"
                )
                results.append(ScrapedPrice(
                    competitor_name=hotel_name,
                    target_date=check_in,
                    price=price,
                    available_rooms=None,
                    source_url=url,
                ))
                logger.info(f"[httpx] {hotel_name} {check_in}: ¥{price:,}")
                await asyncio.sleep(0.5)
            else:
                logger.debug(f"[httpx] No result for {hotel_name} {check_in}, will try Playwright")

    # httpx で取得できなかったホテル・日付を Playwright で再試行
    scraped_keys = {(r.competitor_name, r.target_date) for r in results}
    missing_by_hotel: dict[str, list[str]] = {}
    for hotel in comp_hotels:
        name = hotel["name"]
        missing = [d for d in check_in_dates if (name, d) not in scraped_keys]
        if missing:
            missing_by_hotel[name] = missing

    if missing_by_hotel:
        hotels_for_playwright = [
            h for h in comp_hotels if h["name"] in missing_by_hotel
        ]
        playwright_results = await _scrape_via_playwright(hotels_for_playwright, check_in_dates)
        results.extend(playwright_results)

    return results


async def scrape_dates_range(
    comp_hotels: list[dict],
    start_date: date,
    days: int = 30,
    headless: bool = True,
) -> list[ScrapedPrice]:
    """指定期間の全日付を一括スクレイピング"""
    dates = [
        (start_date + timedelta(days=i)).isoformat()
        for i in range(days)
    ]
    return await scrape_expedia_comp_set(comp_hotels, dates, headless)

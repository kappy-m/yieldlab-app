"""
Expedia 競合価格スクレイパー (Playwright ベース)

使い方:
  results = await scrape_expedia_comp_set(
      comp_hotels=["ホテルA", "ホテルB"],
      expedia_hotel_ids=["12345678", "87654321"],
      check_in_dates=["2025-10-20", "2025-10-21", ...],
  )
"""

import asyncio
import re
import logging
from datetime import date, timedelta
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ScrapedPrice:
    competitor_name: str
    target_date: str      # YYYY-MM-DD
    price: int            # 円
    available_rooms: int | None
    source_url: str


async def scrape_expedia_comp_set(
    comp_hotels: list[dict],   # [{"name": "ホテルA", "expedia_id": "12345678"}, ...]
    check_in_dates: list[str], # ["2025-10-20", ...]
    headless: bool = True,
) -> list[ScrapedPrice]:
    """
    Expedia から競合ホテルの最安値を取得する。

    Note: Expedia の HTML 構造変更により動作しなくなる可能性がある。
    本番運用では OTA Insight / Lighthouse API への移行を推奨。
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("Playwright がインストールされていません: pip install playwright && playwright install chromium")
        return []

    results: list[ScrapedPrice] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="ja-JP",
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
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(2000)

                    # 最安値を取得（Expedia の価格表示要素）
                    price_elements = await page.query_selector_all("[data-stid='price-lockup-lead-price']")
                    prices: list[int] = []

                    for el in price_elements:
                        text = await el.inner_text()
                        nums = re.findall(r"[\d,]+", text.replace(",", ""))
                        if nums:
                            try:
                                prices.append(int(nums[0]))
                            except ValueError:
                                pass

                    if prices:
                        min_price = min(prices)
                        results.append(ScrapedPrice(
                            competitor_name=hotel_name,
                            target_date=check_in,
                            price=min_price,
                            available_rooms=None,
                            source_url=url,
                        ))
                        logger.info(f"Scraped {hotel_name} {check_in}: ¥{min_price:,}")
                    else:
                        logger.warning(f"No price found for {hotel_name} on {check_in}")

                    await page.close()
                    await asyncio.sleep(1.5)  # レート制限対策

                except Exception as e:
                    logger.error(f"Scraping failed for {hotel_name} {check_in}: {e}")
                    await page.close()

        await browser.close()

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

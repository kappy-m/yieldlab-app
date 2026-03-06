"""
マーケット状況サービス
- 日本祝日API (holidays-jp.github.io) から祝日を取得
- 日本橋周辺の季節イベント・需要パターンを組み合わせる
- 今後90日分のマーケットイベントを返す
"""

import logging
from datetime import date, timedelta
from typing import Optional
import httpx
from functools import lru_cache
import asyncio

logger = logging.getLogger(__name__)

HOLIDAYS_API = "https://holidays-jp.github.io/api/v1/{year}/date.json"

# 日本橋エリア特化：季節イベント・需要パターン（月/日 → イベント情報）
SEASONAL_EVENTS = [
    # === 春 ===
    {
        "name": "隅田川・日本橋エリア桜シーズン",
        "type": "季節需要",
        "month_start": 3, "day_start": 22,
        "month_end": 4, "day_end": 10,
        "venue": "隅田川・千鳥ヶ淵・上野恩賜公園",
        "desc": "日本橋周辺の桜スポットへの観光客急増。週末は特に需要が集中し、早期満室が予想されます。",
        "impact": "影響大",
        "icon": "cherry_blossom",
    },
    {
        "name": "東京マラソン",
        "type": "スポーツ",
        "month_start": 3, "day_start": 1,
        "month_end": 3, "day_end": 1,
        "venue": "都心部（日本橋〜銀座コース）",
        "desc": "コースが日本橋を通過。出走者・観客・ボランティアによる需要増。交通規制あり。",
        "impact": "影響大",
        "icon": "sports",
        "recurring_month": 3,
        "recurring_week": 1,  # 3月第1日曜
    },
    # === GW ===
    {
        "name": "ゴールデンウィーク",
        "type": "連休",
        "month_start": 4, "day_start": 29,
        "month_end": 5, "day_end": 5,
        "venue": "都内全域",
        "desc": "年間最大の連休期間。国内・インバウンド需要が急増。早期満室・価格高騰が確実。",
        "impact": "影響大",
        "icon": "holiday",
    },
    # === 初夏 ===
    {
        "name": "日本橋・江戸祭り（仮）",
        "type": "地域イベント",
        "month_start": 5, "day_start": 10,
        "month_end": 5, "day_end": 12,
        "venue": "日本橋室町・中央通り",
        "desc": "日本橋エリアの伝統文化イベント。地元商店街が主催し周辺ホテル需要を押し上げます。",
        "impact": "影響中",
        "icon": "event",
    },
    # === 夏 ===
    {
        "name": "隅田川花火大会",
        "type": "花火・フェスティバル",
        "month_start": 7, "day_start": 26,
        "month_end": 7, "day_end": 26,
        "venue": "隅田川（浅草〜両国）",
        "desc": "約2万発の花火大会。約100万人が来場。周辺ホテルは数ヶ月前から満室になります。",
        "impact": "影響大",
        "icon": "fireworks",
        "recurring_month": 7,
        "recurring_week": 4,  # 7月最終土曜
    },
    {
        "name": "夏休み期間",
        "type": "季節需要",
        "month_start": 7, "day_start": 19,
        "month_end": 8, "day_end": 31,
        "venue": "都内全域",
        "desc": "ファミリー・インバウンド需要が高まる期間。都心ホテルは平均稼働率90%超が見込まれます。",
        "impact": "影響大",
        "icon": "summer",
    },
    # === 秋 ===
    {
        "name": "秋の行楽シーズン",
        "type": "季節需要",
        "month_start": 10, "day_start": 1,
        "month_end": 11, "day_end": 30,
        "venue": "都内各地",
        "desc": "紅葉シーズン・学会・展示会が集中する繁忙期。ビジネス需要と観光需要が重なります。",
        "impact": "影響大",
        "icon": "autumn",
    },
    {
        "name": "コミックマーケット（夏）",
        "type": "大型イベント",
        "month_start": 8, "day_start": 13,
        "month_end": 8, "day_end": 15,
        "venue": "東京ビッグサイト",
        "desc": "国内最大規模の同人誌即売会。20万人超が来場。都心ホテルは会場からのアクセス需要で混雑。",
        "impact": "影響中",
        "icon": "event",
    },
    {
        "name": "コミックマーケット（冬）",
        "type": "大型イベント",
        "month_start": 12, "day_start": 29,
        "month_end": 12, "day_end": 31,
        "venue": "東京ビッグサイト",
        "desc": "年末開催の大型同人誌即売会。年末年始の観光需要と重なり都心ホテルへの需要集中。",
        "impact": "影響中",
        "icon": "event",
    },
    # === 年末年始 ===
    {
        "name": "年末年始・初詣シーズン",
        "type": "季節需要",
        "month_start": 12, "day_start": 28,
        "month_end": 1, "day_end": 5,
        "venue": "都内全域（日本橋・浜町周辺）",
        "desc": "年末年始の特需期間。初詣・帰省・観光が重なり需要が急増。早期に満室が予想されます。",
        "impact": "影響大",
        "icon": "new_year",
    },
    # === ホワイトデー・バレンタイン ===
    {
        "name": "バレンタイン周辺需要",
        "type": "季節需要",
        "month_start": 2, "day_start": 12,
        "month_end": 2, "day_end": 14,
        "venue": "都内（銀座・日本橋エリア）",
        "desc": "カップル需要が集中する週末。日本橋の百貨店・レストランと連動した宿泊需要が増加。",
        "impact": "影響中",
        "icon": "event",
    },
    {
        "name": "ホワイトデー周辺需要",
        "type": "季節需要",
        "month_start": 3, "day_start": 13,
        "month_end": 3, "day_end": 15,
        "venue": "都内（銀座・日本橋エリア）",
        "desc": "カップル需要。春分の日と重なる年は連休効果で需要がさらに高まります。",
        "impact": "影響中",
        "icon": "event",
    },
]

ICON_MAP = {
    "cherry_blossom": "🌸",
    "sports": "🏃",
    "holiday": "🎌",
    "event": "🎪",
    "fireworks": "🎆",
    "summer": "☀️",
    "autumn": "🍂",
    "new_year": "🎍",
}


_holiday_cache: dict[int, dict[str, str]] = {}


async def _fetch_holidays_for_year(year: int) -> dict[str, str]:
    """指定年の祝日をAPIから取得。失敗時は空辞書を返す。"""
    if year in _holiday_cache:
        return _holiday_cache[year]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(HOLIDAYS_API.format(year=year))
            resp.raise_for_status()
            data = resp.json()  # {"YYYY-MM-DD": "祝日名", ...}
            _holiday_cache[year] = data
            return data
    except Exception as e:
        logger.warning(f"[MarketService] 祝日API取得失敗 ({year}): {e}")
        return {}


async def get_holidays_in_range(start: date, end: date) -> dict[str, str]:
    """期間内の祝日を全て取得（複数年にまたがる場合も対応）。"""
    years = set(range(start.year, end.year + 1))
    tasks = [_fetch_holidays_for_year(y) for y in years]
    results = await asyncio.gather(*tasks)
    merged: dict[str, str] = {}
    for r in results:
        merged.update(r)
    # 期間でフィルタ
    return {
        d: name for d, name in merged.items()
        if start.isoformat() <= d <= end.isoformat()
    }


def _impact_level(name: str, consecutive_days: int) -> str:
    """祝日の重要度を計算。"""
    high_keywords = ["元日", "ゴールデン", "年末", "春分", "秋分"]
    if any(k in name for k in high_keywords) or consecutive_days >= 3:
        return "影響大"
    if consecutive_days >= 2:
        return "影響中"
    return "影響小"


def _group_consecutive_holidays(
    holidays: dict[str, str]
) -> list[dict]:
    """連続祝日をグループ化してイベントリストに変換。"""
    if not holidays:
        return []

    sorted_dates = sorted(holidays.keys())
    groups: list[list[str]] = []
    current: list[str] = [sorted_dates[0]]

    for d in sorted_dates[1:]:
        prev = date.fromisoformat(current[-1])
        curr = date.fromisoformat(d)
        # 1〜2日差（週末を挟む連休も考慮）
        if (curr - prev).days <= 3:
            current.append(d)
        else:
            groups.append(current)
            current = [d]
    groups.append(current)

    events = []
    for group in groups:
        start_d = group[0]
        end_d = group[-1]
        names = [holidays[d] for d in group]
        consecutive = len(group)

        if start_d == end_d:
            date_label = start_d
            title = names[0]
        else:
            date_label = f"{start_d}〜{end_d}"
            title = names[0] if consecutive <= 2 else f"{names[0]}〜{names[-1]}"

        impact = _impact_level(title, consecutive)
        events.append({
            "id": f"holiday_{start_d}",
            "name": title,
            "type": "祝日・連休",
            "date_start": start_d,
            "date_end": end_d,
            "date_label": date_label,
            "venue": "国民の祝日",
            "desc": f"{'〜'.join(names[:3])}{'...' if len(names) > 3 else ''}"
                    f"（{consecutive}日間）。宿泊・観光需要が高まります。",
            "impact": impact,
            "icon": "🎌",
            "source": "holiday",
        })
    return events


def _seasonal_events_in_range(start: date, end: date) -> list[dict]:
    """期間内の季節イベントを返す。"""
    results = []
    for ev in SEASONAL_EVENTS:
        # 今年・来年で2回チェック
        for year in [start.year, start.year + 1]:
            # 年末年始は翌年1月も含む
            if ev["month_start"] > ev["month_end"]:
                ev_start = date(year, ev["month_start"], ev["day_start"])
                ev_end = date(year + 1, ev["month_end"], ev["day_end"])
            else:
                ev_start = date(year, ev["month_start"], ev["day_start"])
                ev_end = date(year, ev["month_end"], ev["day_end"])

            # 期間の重複チェック
            if ev_end < start or ev_start > end:
                continue

            date_label = (
                ev_start.isoformat()
                if ev_start == ev_end
                else f"{ev_start.isoformat()}〜{ev_end.isoformat()}"
            )
            results.append({
                "id": f"seasonal_{ev['name']}_{year}",
                "name": ev["name"],
                "type": ev["type"],
                "date_start": ev_start.isoformat(),
                "date_end": ev_end.isoformat(),
                "date_label": date_label,
                "venue": ev["venue"],
                "desc": ev["desc"],
                "impact": ev["impact"],
                "icon": ICON_MAP.get(ev.get("icon", "event"), "🎪"),
                "source": "seasonal",
            })
            break  # 1回分のみ

    return results


async def get_market_events(days_ahead: int = 90) -> list[dict]:
    """今日から days_ahead 日分のマーケットイベントを取得。"""
    today = date.today()
    end = today + timedelta(days=days_ahead)

    # 祝日と季節イベントを並行取得
    holidays_task = get_holidays_in_range(today, end)
    holidays = await holidays_task

    holiday_events = _group_consecutive_holidays(holidays)
    seasonal = _seasonal_events_in_range(today, end)

    # 合体してdate_startでソート
    all_events = holiday_events + seasonal
    all_events.sort(key=lambda e: e["date_start"])

    return all_events

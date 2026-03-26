"""
YieldLab ルールエンジン (Phase 1: ルールベース)

入力:
  - 現在の BAR レベル (1=最高値, 20=最安値 / TL-Lincoln互換)
  - 予約ペース比率 (今年 / 昨年同期)
  - 在庫残数率 (残室 / 総室数)
  - 競合平均価格 vs 自社現在価格
  - 泊日までの日数

出力:
  - 推奨 BAR レベル
  - delta_levels (変動ランク数)
  - reason (推奨理由テキスト)
"""

from dataclasses import dataclass

# 1=最高値, 20=最安値 （TL-Lincoln互換の数値レベル）
BAR_LEVEL_MIN = 1
BAR_LEVEL_MAX = 20
BAR_LEVEL_MID = 10  # デフォルト（標準価格帯）


def _parse_level(level: str) -> int:
    """レベル文字列を整数に変換。不正値はデフォルト(10)を返す。"""
    try:
        v = int(level)
        return max(BAR_LEVEL_MIN, min(BAR_LEVEL_MAX, v))
    except (ValueError, TypeError):
        return BAR_LEVEL_MID


def _to_level_str(idx: int) -> str:
    return str(max(BAR_LEVEL_MIN, min(BAR_LEVEL_MAX, idx)))


@dataclass
class RuleEngineInput:
    current_level: str          # "1"-"20" (1=最高値, 20=最安値)
    pace_ratio: float           # 予約ペース比率 (1.0=昨年並み, 1.2=+20%)
    inventory_ratio: float      # 在庫残数率 (0.0〜1.0)
    competitor_avg_price: float # 競合平均価格（円）
    own_price: float            # 自社現在価格（円）
    days_to_arrival: int        # 泊日まで何日か
    market_impact: str = ""     # "影響大" | "影響中" | "影響小" | ""
    rating_advantage: float = 0.0  # 自社評価 - 競合平均評価


@dataclass
class RuleEngineOutput:
    recommended_level: str
    delta_levels: int           # 正=UP(価格上昇=番号DOWN) / 負=DOWN(価格下落=番号UP) / 0=変化なし
    reason: str
    needs_approval: bool


def recommend(inp: RuleEngineInput, threshold: int = 2) -> RuleEngineOutput:
    """
    レベル値の方向性:
      1 = 最高価格 (high) → 上げる = 番号を下げる
      20 = 最安価格 (low)  → 下げる = 番号を上げる
    """
    current_idx = _parse_level(inp.current_level)
    # 価格調整量 (正=価格UP=番号DOWN, 負=価格DOWN=番号UP)
    adj = 0
    reasons = []

    # --- Rule 1: 予約ペース ---
    if inp.pace_ratio >= 1.20:
        adj += 3
        reasons.append("予約ペースが昨年比+20%超の高需要")
    elif inp.pace_ratio >= 1.10:
        adj += 2
        reasons.append("予約ペースが昨年比+10%超")
    elif inp.pace_ratio >= 1.05:
        adj += 1
        reasons.append("予約ペースが昨年比+5%超")
    elif inp.pace_ratio <= 0.80:
        adj -= 3
        reasons.append("予約ペースが昨年比-20%以下の低需要")
    elif inp.pace_ratio <= 0.90:
        adj -= 2
        reasons.append("予約ペースが昨年比-10%以下")
    elif inp.pace_ratio <= 0.95:
        adj -= 1
        reasons.append("予約ペースが昨年比-5%以下")

    # --- Rule 2: 在庫残数 ---
    if inp.inventory_ratio <= 0.10:
        adj += 3
        reasons.append("残室10%以下（在庫逼迫）")
    elif inp.inventory_ratio <= 0.20:
        adj += 2
        reasons.append("残室20%以下（在庫少）")
    elif inp.inventory_ratio <= 0.30:
        adj += 1
        reasons.append("残室30%以下（在庫やや少）")
    elif inp.inventory_ratio >= 0.80:
        adj -= 2
        reasons.append("残室80%以上（在庫余剰）")
    elif inp.inventory_ratio >= 0.60:
        adj -= 1
        reasons.append("残室60%以上（在庫余裕）")

    # --- Rule 3: 競合価格比較 ---
    if inp.competitor_avg_price > 0 and inp.own_price > 0:
        ratio = inp.own_price / inp.competitor_avg_price
        if ratio < 0.85:
            adj += 2
            reasons.append("競合平均より15%安い（価格引き上げ余地あり）")
        elif ratio < 0.95:
            adj += 1
            reasons.append("競合平均より5%安い（価格引き上げ余地）")
        elif ratio > 1.15:
            adj -= 2
            reasons.append("競合平均より15%高い（価格引き下げ検討）")
        elif ratio > 1.05:
            adj -= 1
            reasons.append("競合平均より5%高い（様子見推奨）")

    # --- Rule 4: 直前割引 ---
    if inp.days_to_arrival <= 5 and inp.inventory_ratio >= 0.40:
        adj -= 2
        reasons.append("直前5日以内で在庫残あり（直前割引推奨）")
    elif inp.days_to_arrival <= 3 and inp.inventory_ratio >= 0.20:
        adj -= 1
        reasons.append("直前3日以内で在庫残（小幅割引推奨）")

    # --- Rule 5: マーケットイベント ---
    if inp.market_impact == "影響大":
        adj += 4
        reasons.append("大型イベント・連休による高需要期（価格引き上げ推奨）")
    elif inp.market_impact == "影響中":
        adj += 2
        reasons.append("中程度のイベント需要あり（価格引き上げ余地）")
    elif inp.market_impact == "影響小":
        adj += 1
        reasons.append("小規模イベント需要あり")

    # --- Rule 6: 競合評価ポジショニング ---
    if inp.rating_advantage >= 0.3 and inp.competitor_avg_price > 0:
        ratio = inp.own_price / inp.competitor_avg_price
        if ratio < 0.95:
            adj += 1
            reasons.append(f"自社評価が競合平均より+{inp.rating_advantage:.1f}pt高く価格引き上げ余地あり")
    elif inp.rating_advantage <= -0.3:
        adj -= 1
        reasons.append("競合評価が自社より高い（価格設定の慎重な見直しを推奨）")

    # 20レベル内でクランプ（価格UP=番号DOWN, 価格DOWN=番号UP）
    new_idx = max(BAR_LEVEL_MIN, min(BAR_LEVEL_MAX, current_idx - adj))
    # delta_levels: 正=価格UP（番号が下がる）, 負=価格DOWN（番号が上がる）
    delta = current_idx - new_idx
    recommended_level = _to_level_str(new_idx)

    reason_text = "。".join(reasons) if reasons else "現在価格は適正水準です"
    needs_appr = abs(delta) > threshold

    return RuleEngineOutput(
        recommended_level=recommended_level,
        delta_levels=delta,
        reason=reason_text,
        needs_approval=needs_appr,
    )


def batch_recommend(
    inputs: list[tuple[str, str, RuleEngineInput]],
    threshold: int = 2,
) -> list[dict]:
    results = []
    for room_name, date_str, inp in inputs:
        out = recommend(inp, threshold)
        results.append({
            "room_name": room_name,
            "date": date_str,
            "current_level": inp.current_level,
            "recommended_level": out.recommended_level,
            "delta_levels": out.delta_levels,
            "reason": out.reason,
            "needs_approval": out.needs_approval,
        })
    return results

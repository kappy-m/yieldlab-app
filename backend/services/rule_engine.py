"""
YieldLab ルールエンジン (Phase 1: ルールベース)

入力:
  - 現在の BAR レベル
  - 予約ペース比率 (今年 / 昨年同期)
  - 在庫残数率 (残室 / 総室数)
  - 競合平均価格 vs 自社現在価格
  - 泊日までの日数

出力:
  - 推奨 BAR レベル
  - delta_levels (変動ランク数)
  - reason (推奨理由テキスト)
"""

from dataclasses import dataclass, field

BAR_LEVELS = ["E", "D", "C", "B", "A"]  # 0=最安値, 4=最高値


@dataclass
class RuleEngineInput:
    current_level: str          # A / B / C / D / E
    pace_ratio: float           # 予約ペース比率 (1.0 = 昨年並み, 1.2 = +20%)
    inventory_ratio: float      # 在庫残数率 (0.0〜1.0)
    competitor_avg_price: float # 競合平均価格（円）
    own_price: float            # 自社現在価格（円）
    days_to_arrival: int        # 泊日まで何日か
    # Rule 5: マーケットイベント影響度 ("影響大" | "影響中" | "影響小" | "")
    market_impact: str = ""
    # Rule 6: 競合評価との比較 (自社評価 - 競合平均評価)
    rating_advantage: float = 0.0  # 正=自社優位, 負=競合優位


@dataclass
class RuleEngineOutput:
    recommended_level: str
    delta_levels: int           # 正=UP / 負=DOWN / 0=変化なし
    reason: str
    needs_approval: bool        # 閾値を超えたら True


def recommend(inp: RuleEngineInput, threshold: int = 1) -> RuleEngineOutput:
    current_idx = BAR_LEVELS.index(inp.current_level) if inp.current_level in BAR_LEVELS else 2
    adj = 0
    reasons = []

    # --- Rule 1: 予約ペース ---
    if inp.pace_ratio >= 1.20:
        adj += 2
        reasons.append("予約ペースが昨年比+20%超の高需要")
    elif inp.pace_ratio >= 1.10:
        adj += 1
        reasons.append("予約ペースが昨年比+10%超")
    elif inp.pace_ratio <= 0.80:
        adj -= 2
        reasons.append("予約ペースが昨年比-20%以下の低需要")
    elif inp.pace_ratio <= 0.90:
        adj -= 1
        reasons.append("予約ペースが昨年比-10%以下")

    # --- Rule 2: 在庫残数 ---
    if inp.inventory_ratio <= 0.10:
        adj += 2
        reasons.append("残室10%以下（在庫逼迫）")
    elif inp.inventory_ratio <= 0.20:
        adj += 1
        reasons.append("残室20%以下（在庫少）")
    elif inp.inventory_ratio >= 0.80:
        adj -= 1
        reasons.append("残室80%以上（在庫余剰）")

    # --- Rule 3: 競合価格比較 ---
    if inp.competitor_avg_price > 0 and inp.own_price > 0:
        ratio = inp.own_price / inp.competitor_avg_price
        if ratio < 0.85:
            adj += 1
            reasons.append(f"競合平均より15%安い（価格引き上げ余地あり）")
        elif ratio > 1.15:
            adj -= 1
            reasons.append(f"競合平均より15%高い（価格引き下げ検討）")

    # --- Rule 4: 直前割引 (直前5日以内で在庫残あり) ---
    if inp.days_to_arrival <= 5 and inp.inventory_ratio >= 0.40:
        adj -= 1
        reasons.append("直前5日以内で在庫残あり（直前割引推奨）")

    # --- Rule 5: マーケットイベント影響度 ---
    if inp.market_impact == "影響大":
        adj += 2
        reasons.append("大型イベント・連休による高需要期（価格引き上げ推奨）")
    elif inp.market_impact == "影響中":
        adj += 1
        reasons.append("中程度のイベント需要あり（価格引き上げ余地）")

    # --- Rule 6: 競合評価ポジショニング ---
    # 自社評価が競合より高く、かつ価格が競合より安い場合は値上げ余地あり
    if inp.rating_advantage >= 0.3 and inp.competitor_avg_price > 0:
        ratio = inp.own_price / inp.competitor_avg_price
        if ratio < 0.95:
            adj += 1
            reasons.append(f"自社評価が競合平均より+{inp.rating_advantage:.1f}pt高く価格引き上げ余地あり")
    elif inp.rating_advantage <= -0.3:
        # 自社評価が競合より低い場合は価格を抑制
        adj -= 1
        reasons.append(f"競合評価が自社より高い（価格設定の慎重な見直しを推奨）")

    # 範囲クランプ
    new_idx = max(0, min(4, current_idx + adj))
    delta = new_idx - current_idx
    recommended_level = BAR_LEVELS[new_idx]

    reason_text = "。".join(reasons) if reasons else "現在価格は適正水準です"
    needs_appr = abs(delta) > threshold

    return RuleEngineOutput(
        recommended_level=recommended_level,
        delta_levels=delta,
        reason=reason_text,
        needs_approval=needs_appr,
    )


def batch_recommend(
    inputs: list[tuple[str, str, RuleEngineInput]],  # (room_name, date, input)
    threshold: int = 1,
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

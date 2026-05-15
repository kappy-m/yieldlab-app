"""
YieldLab プライシングエンジン v3

Module 1: DemandForecaster   - 季節性・イベント・客層・天気・キャンセル率から需要指数を算出
Module 2: SupplyAnalyzer     - 競合価格の速度・分散から供給圧縮を推定
Module 3: PaceAnalyzer       - 自社予約ペースを理想曲線と比較
Module 4: PositionEvaluator  - ブランドフロア・Rating・Circuit Breaker を評価
Module 5: WeightOptimizer    - 過去実績から scipy Nelder-Mead で信号重みを自動学習
                               Cold Start 対応: full / cohort / market_only の3モード
Module 6: PriceOptimizer     - 加重スコアを BAR 変動幅に変換（Circuit Breaker 適用）
Module 7: HierarchyConstraint- 部屋タイプ間の価格逆転を後処理で修正

v3 新機能 (CP2a/CP3/CP5 = Phase 1):
  - WeatherSignal: OpenMeteo API → 台風・大雪時に demand_index を減衰
  - RatingCircuitBreaker: overall_rating 30日下落 -0.1 で値上げを凍結
  - CancellationSignal: 曜日×月のキャンセル率が +1σ/+2σ 超えで demand_index を補正

v3 新機能 (CP1/CP4b/CP6 = Phase 2):
  - GoogleTrendsSignal: エリア×旅行クエリの週次トレンドを demand_index に反映
  - SignalRegistry: BaseSignal 継承クラスをプラグイン方式で登録
  - Cold Start market_only モード: 自社データ不要、競合+ペースのみで動作
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

import numpy as np
from scipy.optimize import minimize
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    BarLadder,
    BookingSnapshot,
    CompetitorPrice,
    CompetitorRating,
    DailyPerformance,
    PricingGrid,
    Recommendation,
    Reservation,
    RoomType,
)
from ..models.property import Property
from ..services.market_service import get_market_events
from ..services.signals import CancellationSignal, GoogleTrendsSignal, WeatherSignal
from ..services.signals.base import BaseSignal

logger = logging.getLogger(__name__)

BAR_MIN = 1    # 最高値（高い方）
BAR_MAX = 20   # 最安値（低い方）
MIN_ROOM_SPREAD = 1  # 隣接部屋タイプ間の最小 BAR 段差

DEFAULT_WEIGHTS = np.array([0.35, 0.25, 0.25, 0.15])


# ─────────────────────────────────────────
# データクラス
# ─────────────────────────────────────────

@dataclass
class PositionConstraint:
    brand_floor_level: int
    rating_premium_levels: int
    brand_target_percentile: float
    price_increase_frozen: bool = False  # Rating Circuit Breaker が有効かどうか


@dataclass
class SignalBundle:
    demand_index: float   # 0.5〜2.0
    supply_signal: float  # -1.0〜+1.0
    pace_deviation: float # -1.0〜+1.0
    position_gap: float   # -1.0〜+1.0


# ─────────────────────────────────────────
# SignalRegistry
# ─────────────────────────────────────────

class SignalRegistry:
    """
    BaseSignal インスタンスを名前で登録し、一括 compute を提供する。
    各シグナルは乗算係数 (1.0 = 中立) を返す。失敗時は 1.0 にフォールバック。
    """

    def __init__(self) -> None:
        self._signals: dict[str, BaseSignal] = {}

    def register(self, name: str, signal: BaseSignal) -> None:
        self._signals[name] = signal

    async def compute_all(
        self,
        dates: list[date],
        db: AsyncSession,
        **kwargs: object,
    ) -> dict[str, dict[date, float]]:
        """登録済みシグナル全件を compute して返す。エラーは 1.0 にフォールバック。"""
        results: dict[str, dict[date, float]] = {}
        for name, sig in self._signals.items():
            try:
                results[name] = await sig.compute(dates, db, **kwargs)
            except Exception as exc:
                logger.warning("[SignalRegistry] %s 失敗 → 1.0 フォールバック: %s", name, exc)
                results[name] = {d: 1.0 for d in dates}
        return results


# ─────────────────────────────────────────
# Module 1: DemandForecaster
# ─────────────────────────────────────────

class DemandForecaster:
    """エリア需要を DemandIndex (0.5〜2.0) で表現する。1.0 = 平常需要。"""

    def __init__(self) -> None:
        self._registry = SignalRegistry()
        self._registry.register("weather", WeatherSignal())
        self._registry.register("cancellation", CancellationSignal())
        self._registry.register("google_trends", GoogleTrendsSignal())

    async def forecast(
        self,
        property_id: int,
        target_dates: list[date],
        event_area: str,
        db: AsyncSession,
    ) -> dict[date, float]:
        seasonal = await self._seasonal_factors(property_id, target_dates, db)
        event_lifts = await self._event_lifts(target_dates, event_area)
        holiday_mult = await self._segment_holiday_multiplier(property_id, db)

        # 外部シグナルを一括取得
        signals = await self._registry.compute_all(
            target_dates,
            db,
            event_area=event_area,
            property_id=property_id,
        )
        weather_map = signals.get("weather", {})
        cancel_map = signals.get("cancellation", {})
        trends_map = signals.get("google_trends", {})

        result: dict[date, float] = {}
        for d in target_dates:
            sf = seasonal.get(d, 1.0)
            el = event_lifts.get(d, 0.0)
            h_mult = holiday_mult if el > 0.05 else 1.0

            # 基本需要指数
            index = sf * (1.0 + el) * h_mult

            # 外部シグナル乗算（すべて係数。1.0 = 中立）
            index *= weather_map.get(d, 1.0)
            index *= cancel_map.get(d, 1.0)
            index *= trends_map.get(d, 1.0)

            result[d] = max(0.5, min(2.0, index))

        return result

    async def _seasonal_factors(
        self,
        property_id: int,
        target_dates: list[date],
        db: AsyncSession,
    ) -> dict[date, float]:
        """過去の DailyPerformance から曜日×月の季節指数を算出"""
        res = await db.execute(
            select(DailyPerformance.date, DailyPerformance.occupancy_rate).where(
                and_(
                    DailyPerformance.property_id == property_id,
                    DailyPerformance.date < date.today(),
                )
            )
        )
        rows = res.all()

        if len(rows) < 30:
            return {}

        dow_month: dict[tuple[int, int], list[float]] = {}
        for row in rows:
            key = (row.date.weekday(), row.date.month)
            dow_month.setdefault(key, []).append(row.occupancy_rate)

        dow_month_avg = {k: sum(v) / len(v) for k, v in dow_month.items()}
        overall_avg = sum(r.occupancy_rate for r in rows) / len(rows)

        if overall_avg == 0:
            return {}

        factors: dict[date, float] = {}
        for d in target_dates:
            key = (d.weekday(), d.month)
            avg = dow_month_avg.get(key)
            if avg is not None:
                factors[d] = avg / overall_avg
            else:
                dow_vals = [
                    v for (dow, _), vals in dow_month.items()
                    if dow == d.weekday()
                    for v in vals
                ]
                if dow_vals:
                    factors[d] = (sum(dow_vals) / len(dow_vals)) / overall_avg

        return factors

    async def _event_lifts(
        self,
        target_dates: list[date],
        event_area: str,
    ) -> dict[date, float]:
        """市場イベントから各日のリフト係数を算出"""
        if not target_dates:
            return {}

        max_days = max((d - date.today()).days for d in target_dates) + 10
        events = await get_market_events(days_ahead=max(max_days, 90), event_area=event_area)

        impact_value = {"影響大": 0.40, "影響中": 0.20, "影響小": 0.08}
        lifts: dict[date, float] = {d: 0.0 for d in target_dates}

        for ev in events:
            ev_start = date.fromisoformat(ev["date_start"])
            ev_end = date.fromisoformat(ev["date_end"])
            base = impact_value.get(ev.get("impact", ""), 0.0)
            if base == 0.0:
                continue

            days_until = max(0, (ev_start - date.today()).days)
            proximity = 1.0 if days_until <= 3 else (0.7 if days_until <= 14 else 0.4)

            for d in target_dates:
                if ev_start <= d <= ev_end:
                    lifts[d] = max(lifts[d], base * proximity)

        return lifts

    async def _segment_holiday_multiplier(
        self,
        property_id: int,
        db: AsyncSession,
    ) -> float:
        """OTA 予約比率からレジャー客割合を算出し、祝日感応度を返す"""
        cutoff = date.today() - timedelta(days=90)
        res = await db.execute(
            select(Reservation.ota_channel).where(
                and_(
                    Reservation.property_id == property_id,
                    Reservation.booking_date >= cutoff,
                    Reservation.status != "cancelled",
                )
            )
        )
        channels = [r.ota_channel for r in res.all() if r.ota_channel]

        if not channels:
            return 1.0

        leisure_kw = ["rakuten", "jalan", "booking", "expedia", "agoda", "ota", "楽天", "じゃらん"]
        leisure = sum(1 for c in channels if any(kw in c.lower() for kw in leisure_kw))
        leisure_ratio = leisure / len(channels)
        return 1.0 + leisure_ratio * 0.3


# ─────────────────────────────────────────
# Module 2: SupplyAnalyzer
# ─────────────────────────────────────────

class SupplyAnalyzer:
    """
    競合稼働率は楽天スクレイプで取得不能なため、
    価格の速度（velocity）と分散（dispersion）を供給圧縮の代理変数として使用。
    """

    async def analyze(
        self,
        property_id: int,
        target_dates: list[date],
        db: AsyncSession,
    ) -> dict[date, float]:
        """各日の SupplySignal (-1.0〜+1.0) を返す。正 = 市場圧縮。"""
        if not target_dates:
            return {}

        fetch_from = min(target_dates) - timedelta(days=14)
        res = await db.execute(
            select(
                CompetitorPrice.target_date,
                CompetitorPrice.price,
            ).where(
                and_(
                    CompetitorPrice.property_id == property_id,
                    CompetitorPrice.target_date >= fetch_from,
                    CompetitorPrice.target_date <= max(target_dates),
                )
            ).order_by(CompetitorPrice.target_date)
        )
        rows = res.all()

        if not rows:
            return {d: 0.0 for d in target_dates}

        price_by_date: dict[date, list[int]] = {}
        for row in rows:
            td = row.target_date if isinstance(row.target_date, date) else date.fromisoformat(str(row.target_date))
            price_by_date.setdefault(td, []).append(row.price)

        signals: dict[date, float] = {}
        for d in target_dates:
            velocity = self._price_velocity(d, price_by_date)
            dispersion = self._price_dispersion(d, price_by_date)
            raw = velocity * 0.6 + (1.0 - dispersion) * 0.4 - 0.5
            signals[d] = max(-1.0, min(1.0, raw * 2))

        return signals

    def _price_velocity(
        self,
        d: date,
        price_by_date: dict[date, list[int]],
    ) -> float:
        today_p = price_by_date.get(d, [])
        past_p: list[int] = []
        for delta in range(1, 8):
            past_p.extend(price_by_date.get(d - timedelta(days=delta), []))

        if not today_p or not past_p:
            return 0.0

        avg_now = sum(today_p) / len(today_p)
        avg_past = sum(past_p) / len(past_p)
        if avg_past == 0:
            return 0.0

        return max(-1.0, min(1.0, (avg_now - avg_past) / avg_past * 5))

    def _price_dispersion(
        self,
        d: date,
        price_by_date: dict[date, list[int]],
    ) -> float:
        prices = price_by_date.get(d, [])
        if len(prices) < 2:
            return 0.5

        avg = sum(prices) / len(prices)
        if avg == 0:
            return 0.5

        variance = sum((p - avg) ** 2 for p in prices) / len(prices)
        cv = math.sqrt(variance) / avg
        return min(1.0, cv * 3)

    async def price_position(
        self,
        property_id: int,
        target_dates: list[date],
        own_prices: dict[tuple[int, date], int],
        target_percentile: float,
        db: AsyncSession,
    ) -> dict[date, float]:
        """自社価格の競合内パーセンタイル vs 目標パーセンタイルの差を返す"""
        if not target_dates:
            return {}

        res = await db.execute(
            select(CompetitorPrice.target_date, CompetitorPrice.price).where(
                and_(
                    CompetitorPrice.property_id == property_id,
                    CompetitorPrice.target_date.in_(target_dates),
                )
            )
        )
        comp_by_date: dict[date, list[int]] = {}
        for row in res.all():
            td = row.target_date if isinstance(row.target_date, date) else date.fromisoformat(str(row.target_date))
            comp_by_date.setdefault(td, []).append(row.price)

        positions: dict[date, float] = {}
        for d in target_dates:
            comp = sorted(comp_by_date.get(d, []))
            if not comp:
                positions[d] = 0.0
                continue

            own_today = [v for (_, dt), v in own_prices.items() if dt == d]
            if not own_today:
                positions[d] = 0.0
                continue

            own_avg = sum(own_today) / len(own_today)
            below = sum(1 for p in comp if p < own_avg)
            own_pct = below / len(comp)
            positions[d] = max(-1.0, min(1.0, (target_percentile - own_pct) * 2))

        return positions


# ─────────────────────────────────────────
# Module 3: PaceAnalyzer
# ─────────────────────────────────────────

class PaceAnalyzer:
    """自社予約ペースを BookingSnapshot の全期間平均（理想曲線）と比較する"""

    async def analyze(
        self,
        property_id: int,
        total_rooms: int,
        target_dates: list[date],
        db: AsyncSession,
    ) -> dict[date, float]:
        ideal_curve = await self._build_ideal_curve(property_id, db)
        snap_today = await self._today_snapshots(property_id, db)

        result: dict[date, float] = {}
        for d in target_dates:
            days_before = (d - date.today()).days
            if days_before < 0:
                result[d] = 0.0
                continue

            actual = snap_today.get(d, 0)
            ideal = ideal_curve.get(days_before)

            if ideal is None or total_rooms == 0:
                result[d] = 0.0
            else:
                result[d] = max(-1.0, min(1.0, (actual - ideal) / total_rooms * 3))

        return result

    async def _build_ideal_curve(
        self,
        property_id: int,
        db: AsyncSession,
    ) -> dict[int, float]:
        res = await db.execute(
            select(
                BookingSnapshot.target_date,
                BookingSnapshot.capture_date,
                BookingSnapshot.booked_rooms,
            ).where(BookingSnapshot.property_id == property_id)
        )
        by_days: dict[int, list[int]] = {}
        for row in res.all():
            td = row.target_date if isinstance(row.target_date, date) else date.fromisoformat(str(row.target_date))
            cd = row.capture_date if isinstance(row.capture_date, date) else date.fromisoformat(str(row.capture_date))
            days = (td - cd).days
            if 0 <= days <= 365:
                by_days.setdefault(days, []).append(row.booked_rooms)

        return {days: sum(v) / len(v) for days, v in by_days.items() if len(v) >= 3}

    async def _today_snapshots(
        self,
        property_id: int,
        db: AsyncSession,
    ) -> dict[date, int]:
        res = await db.execute(
            select(BookingSnapshot.target_date, BookingSnapshot.booked_rooms).where(
                and_(
                    BookingSnapshot.property_id == property_id,
                    BookingSnapshot.capture_date == date.today(),
                )
            )
        )
        result: dict[date, int] = {}
        for row in res.all():
            td = row.target_date if isinstance(row.target_date, date) else date.fromisoformat(str(row.target_date))
            result[td] = row.booked_rooms
        return result


# ─────────────────────────────────────────
# Module 4: PositionEvaluator
# ─────────────────────────────────────────

class PositionEvaluator:
    """ブランドフロア・Rating プレミアム・Circuit Breaker を評価する"""

    _BRAND_FLOOR: dict[int, int] = {5: 10, 4: 14, 3: 17, 2: 19}
    _BRAND_TARGET_PCT: dict[int, float] = {5: 0.80, 4: 0.70, 3: 0.55, 2: 0.45}

    # Circuit Breaker トリガー閾値
    _CB_TRIGGER_DELTA = -0.1   # 30日間でこれ以上下落したら凍結

    async def evaluate(
        self,
        property_id: int,
        star_rating: int | None,
        db: AsyncSession,
    ) -> PositionConstraint:
        star = star_rating or 3
        brand_floor = self._BRAND_FLOOR.get(star, 18)
        target_pct = self._BRAND_TARGET_PCT.get(star, 0.55)
        rating_premium = await self._rating_premium(property_id, db)
        is_frozen = await self._rating_circuit_breaker(property_id, db)

        return PositionConstraint(
            brand_floor_level=brand_floor,
            rating_premium_levels=rating_premium,
            brand_target_percentile=target_pct,
            price_increase_frozen=is_frozen,
        )

    async def _rating_premium(self, property_id: int, db: AsyncSession) -> int:
        res = await db.execute(
            select(
                CompetitorRating.is_own_property,
                CompetitorRating.overall,
            ).where(
                and_(
                    CompetitorRating.property_id == property_id,
                    CompetitorRating.overall.is_not(None),
                )
            )
        )
        rows = res.all()

        own = [r.overall for r in rows if r.is_own_property and r.overall is not None]
        comp = [r.overall for r in rows if not r.is_own_property and r.overall is not None]

        if not own or not comp:
            return 0

        advantage = (sum(own) / len(own)) - (sum(comp) / len(comp))
        if advantage >= 0.3:
            return 2
        if advantage >= 0.1:
            return 1
        return 0

    async def _rating_circuit_breaker(self, property_id: int, db: AsyncSession) -> bool:
        """
        アクティブな価格凍結が存在するか確認する。
        凍結判定・更新は check_and_update_circuit_breaker() が担当するため、
        ここでは price_freeze_logs テーブルを読むだけ。
        """
        from ..models.price_freeze_log import PriceFreezeLog
        res = await db.execute(
            select(PriceFreezeLog.is_active).where(
                and_(
                    PriceFreezeLog.property_id == property_id,
                    PriceFreezeLog.is_active == True,
                )
            )
        )
        row = res.first()
        return row is not None


async def check_and_update_circuit_breaker(property_id: int, db: AsyncSession) -> None:
    """
    最新の overall_rating を取得し、Circuit Breaker の凍結状態を更新する。
    評価更新ジョブ（週1回）から呼び出す。

    ロジック:
      1. 自社の own overall_rating を取得
      2. アクティブな freeze_log があれば baseline と比較
         - current - baseline < -0.1 → 凍結継続
         - current - baseline >= -0.05 → 解除（自動回復）
      3. アクティブな freeze_log がなければ基準値を記録（凍結しない）
    """
    from ..models.price_freeze_log import PriceFreezeLog

    # 自社の現在 overall_rating
    res = await db.execute(
        select(CompetitorRating.overall).where(
            and_(
                CompetitorRating.property_id == property_id,
                CompetitorRating.is_own_property == True,
                CompetitorRating.overall.is_not(None),
            )
        ).order_by(CompetitorRating.overall.desc()).limit(1)
    )
    row = res.first()
    if row is None:
        return
    current_overall: float = row.overall

    # アクティブな凍結レコードを取得
    freeze_res = await db.execute(
        select(PriceFreezeLog).where(
            and_(
                PriceFreezeLog.property_id == property_id,
                PriceFreezeLog.is_active == True,
            )
        ).limit(1)
    )
    freeze = freeze_res.scalar_one_or_none()

    if freeze is not None:
        delta = current_overall - freeze.baseline_overall
        if delta >= -0.05:
            # 回復 → 自動解除
            freeze.is_active = False
            freeze.released_at = datetime.now(timezone.utc)
            freeze.trigger_reason += f" | 自動解除: current={current_overall:.2f}"
            logger.info(
                "[CircuitBreaker] 自動解除 (property=%d, delta=%.3f)",
                property_id, delta,
            )
    else:
        # 凍結レコードがない = 初回または前回解除済み
        # 最新の非アクティブレコードからベースラインを取得
        prev_res = await db.execute(
            select(PriceFreezeLog).where(
                PriceFreezeLog.property_id == property_id,
            ).order_by(PriceFreezeLog.id.desc()).limit(1)
        )
        prev = prev_res.scalar_one_or_none()

        if prev is None:
            # 初回: 基準値として記録するだけ（凍結しない）
            baseline = current_overall
        else:
            baseline = prev.baseline_overall

        delta = current_overall - baseline
        if delta < -0.1:
            new_freeze = PriceFreezeLog(
                property_id=property_id,
                is_active=True,
                baseline_overall=baseline,
                trigger_overall=current_overall,
                trigger_reason=(
                    f"overall_rating 30日トレンドが -{abs(delta):.3f} 下落 "
                    f"(baseline={baseline:.2f} → current={current_overall:.2f})"
                ),
            )
            db.add(new_freeze)
            logger.warning(
                "[CircuitBreaker] 凍結開始 (property=%d, delta=%.3f)",
                property_id, delta,
            )

    await db.commit()


# ─────────────────────────────────────────
# Module 5: WeightOptimizer
# ─────────────────────────────────────────

class WeightOptimizer:
    """
    過去の実績データから信号の重みを SciPy Nelder-Mead で自動学習する。

    cold_start_mode:
      "full"        - 1stパーティデータあり。180日実績で学習（既存挙動）
      "cohort"      - 新規館。同星数・エリアの cohort_weights テーブルから流用（Phase 3）
      "market_only" - 自社データ非公開。供給+ペースのみ（w=[0,0.5,0.5,0]）
    """

    MIN_SAMPLES = 30
    LOOKBACK_DAYS = 180

    _MARKET_ONLY_WEIGHTS = np.array([0.0, 0.5, 0.5, 0.0])

    async def fit(
        self,
        property_id: int,
        db: AsyncSession,
        cold_start_mode: str = "full",
    ) -> np.ndarray:
        if cold_start_mode == "market_only":
            logger.info("[WeightOptimizer] market_only モード (property=%d)", property_id)
            return self._MARKET_ONLY_WEIGHTS.copy()

        if cold_start_mode == "cohort":
            cohort_w = await self._cohort_weights(property_id, db)
            if cohort_w is not None:
                logger.info("[WeightOptimizer] cohort 重み使用 (property=%d)", property_id)
                return cohort_w

        # full モード（既存ロジック）
        X, y = await self._build_training_data(property_id, db)

        if X.shape[0] < self.MIN_SAMPLES:
            logger.info(
                "[WeightOptimizer] データ不足のためデフォルト重みを使用 (n=%d)",
                X.shape[0],
            )
            return DEFAULT_WEIGHTS.copy()

        def objective(raw_w: np.ndarray) -> float:
            w = np.abs(raw_w)
            total = w.sum()
            if total < 1e-9:
                return 1e9
            predicted = X @ (w / total)
            return float(np.sum((predicted - y) ** 2))

        result = minimize(
            objective,
            x0=DEFAULT_WEIGHTS.copy(),
            method="Nelder-Mead",
            options={"maxiter": 2000, "xatol": 1e-4, "fatol": 1e-4},
        )

        raw = np.abs(result.x)
        total = raw.sum()
        weights = raw / total if total > 1e-9 else DEFAULT_WEIGHTS.copy()
        logger.info("[WeightOptimizer] 学習済み重み: %s (n=%d)", np.round(weights, 3), X.shape[0])
        return weights

    async def _cohort_weights(
        self,
        property_id: int,
        db: AsyncSession,
    ) -> np.ndarray | None:
        """
        同星数・エリアの cohort_weights テーブルから重みを取得する（Phase 3 実装後に有効化）。
        コホート館数 < 3 の場合は None を返してデフォルト重みにフォールバック。
        """
        # Phase 3 データ蓄積後に実装
        # from ..models.cohort_weights import CohortWeights
        # ...
        return None

    async def _build_training_data(
        self,
        property_id: int,
        db: AsyncSession,
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        特徴量 X と目的変数 y を過去実績から構築する。

        X[:, 0] = demand proxy : 季節指数 - 1
        X[:, 1] = supply proxy : 競合価格速度
        X[:, 2] = pace proxy   : 30日前の予約偏差
        X[:, 3] = position     : 定数 0.1
        y       = 正規化 RevPAR (-1.0〜+1.0)
        """
        cutoff = date.today() - timedelta(days=self.LOOKBACK_DAYS)

        perf_res = await db.execute(
            select(DailyPerformance).where(
                and_(
                    DailyPerformance.property_id == property_id,
                    DailyPerformance.date >= cutoff,
                    DailyPerformance.date < date.today(),
                )
            ).order_by(DailyPerformance.date)
        )
        perfs = perf_res.scalars().all()

        if not perfs:
            return np.empty((0, 4)), np.empty(0)

        dow_month: dict[tuple[int, int], list[float]] = {}
        for p in perfs:
            key = (p.date.weekday(), p.date.month)
            dow_month.setdefault(key, []).append(p.occupancy_rate)
        dow_month_avg = {k: sum(v) / len(v) for k, v in dow_month.items()}
        overall_avg = sum(p.occupancy_rate for p in perfs) / len(perfs)

        comp_res = await db.execute(
            select(CompetitorPrice.target_date, CompetitorPrice.price).where(
                and_(
                    CompetitorPrice.property_id == property_id,
                    CompetitorPrice.target_date >= cutoff,
                    CompetitorPrice.target_date < date.today(),
                )
            )
        )
        comp_by_date: dict[date, list[int]] = {}
        for row in comp_res.all():
            td = row.target_date if isinstance(row.target_date, date) else date.fromisoformat(str(row.target_date))
            comp_by_date.setdefault(td, []).append(row.price)

        snap_res = await db.execute(
            select(
                BookingSnapshot.target_date,
                BookingSnapshot.capture_date,
                BookingSnapshot.booked_rooms,
            ).where(
                and_(
                    BookingSnapshot.property_id == property_id,
                    BookingSnapshot.target_date >= cutoff,
                )
            )
        )
        snap_map: dict[tuple[date, int], int] = {}
        snap_by_days: dict[int, list[int]] = {}
        for row in snap_res.all():
            td = row.target_date if isinstance(row.target_date, date) else date.fromisoformat(str(row.target_date))
            cd = row.capture_date if isinstance(row.capture_date, date) else date.fromisoformat(str(row.capture_date))
            days = (td - cd).days
            if 0 <= days <= 365:
                snap_map[(td, days)] = row.booked_rooms
                snap_by_days.setdefault(days, []).append(row.booked_rooms)

        ideal_30d = sum(snap_by_days.get(30, [])) / len(snap_by_days[30]) if snap_by_days.get(30) else 0.0

        revpars = [p.revpar for p in perfs]
        min_r, max_r = min(revpars), max(revpars)
        range_r = max_r - min_r if max_r != min_r else 1.0

        X_rows: list[list[float]] = []
        y_rows: list[float] = []

        for p in perfs:
            key = (p.date.weekday(), p.date.month)
            seasonal = dow_month_avg.get(key, overall_avg) / overall_avg if overall_avg > 0 else 1.0
            demand_proxy = max(-2.0, min(2.0, seasonal - 1.0))

            today_p = comp_by_date.get(p.date, [])
            past_p: list[int] = []
            for delta in range(1, 8):
                past_p.extend(comp_by_date.get(p.date - timedelta(days=delta), []))
            if today_p and past_p:
                supply_proxy = max(-1.0, min(1.0, (sum(today_p) / len(today_p)) / (sum(past_p) / len(past_p)) - 1.0) * 5)
            else:
                supply_proxy = 0.0

            booked_30d = snap_map.get((p.date, 30), 0)
            pace_proxy = max(-1.0, min(1.0, (booked_30d - ideal_30d) / ideal_30d)) if ideal_30d > 0 else 0.0

            X_rows.append([demand_proxy, supply_proxy, pace_proxy, 0.1])
            y_rows.append((p.revpar - min_r) / range_r * 2.0 - 1.0)

        return np.array(X_rows), np.array(y_rows)


# ─────────────────────────────────────────
# Module 6: PriceOptimizer
# ─────────────────────────────────────────

class PriceOptimizer:
    """4つの信号を加重スコアに変換して BAR 変動幅 (delta_levels) を算出する"""

    def optimize(
        self,
        current_bar_level: int,
        signals: SignalBundle,
        weights: np.ndarray,
        constraint: PositionConstraint,
    ) -> tuple[int, int]:
        """
        Returns:
            (new_bar_level, delta_levels)
            delta_levels: 正 = 価格UP（BAR番号DOWN）, 負 = 価格DOWN（BAR番号UP）
        """
        demand_norm = (signals.demand_index - 1.0) / 1.0
        demand_norm = max(-1.0, min(1.0, demand_norm))

        raw_score = float(
            weights[0] * demand_norm
            + weights[1] * signals.supply_signal
            + weights[2] * signals.pace_deviation
            + weights[3] * signals.position_gap
        )

        delta = round(raw_score * 6)

        # Rating Circuit Breaker: 値上げ方向を封印
        if constraint.price_increase_frozen and delta > 0:
            delta = 0

        floor = constraint.brand_floor_level
        new_level = max(BAR_MIN, min(floor, current_bar_level - delta))

        premium_cap = max(BAR_MIN, current_bar_level - delta - constraint.rating_premium_levels)
        new_level = max(BAR_MIN, min(new_level, premium_cap + constraint.rating_premium_levels))

        actual_delta = current_bar_level - new_level
        return new_level, actual_delta


# ─────────────────────────────────────────
# Module 7: HierarchyConstraint
# ─────────────────────────────────────────

class HierarchyConstraint:
    """
    全部屋タイプの推奨確定後、sort_order 順に BAR 逆転を後処理で修正する。
    """

    def apply(
        self,
        recs: list[Recommendation],
        room_types: list[RoomType],
    ) -> list[Recommendation]:
        if len(room_types) <= 1:
            return recs

        sorted_rt = sorted(room_types, key=lambda r: r.sort_order)
        rec_map: dict[tuple[int, date], Recommendation] = {}
        for rec in recs:
            td = rec.target_date if isinstance(rec.target_date, date) else date.fromisoformat(str(rec.target_date))
            rec_map[(rec.room_type_id, td)] = rec

        all_dates = {
            (rec.target_date if isinstance(rec.target_date, date) else date.fromisoformat(str(rec.target_date)))
            for rec in recs
        }

        for d in all_dates:
            for i in range(len(sorted_rt) - 1):
                lower_rt = sorted_rt[i]
                higher_rt = sorted_rt[i + 1]

                rec_lower = rec_map.get((lower_rt.id, d))
                rec_higher = rec_map.get((higher_rt.id, d))

                if rec_lower is None or rec_higher is None:
                    continue

                lower_level = int(rec_lower.recommended_bar_level)
                higher_level = int(rec_higher.recommended_bar_level)

                if higher_level >= lower_level - MIN_ROOM_SPREAD + 1:
                    corrected = lower_level - MIN_ROOM_SPREAD
                    corrected = max(BAR_MIN, corrected)
                    rec_higher.recommended_bar_level = str(corrected)
                    rec_higher.reason = (rec_higher.reason or "") + "。部屋ヒエラルキーを維持するため調整。"

        return recs


# ─────────────────────────────────────────
# PricingEngine（ファサード）
# ─────────────────────────────────────────

class PricingEngine:
    """
    Module 1〜7 を統合して推奨リストを生成するファサード。
    recommendations.py から呼び出す。
    """

    def __init__(self) -> None:
        self._demand = DemandForecaster()
        self._supply = SupplyAnalyzer()
        self._pace = PaceAnalyzer()
        self._position = PositionEvaluator()
        self._weight_opt = WeightOptimizer()
        self._price_opt = PriceOptimizer()
        self._hierarchy = HierarchyConstraint()

    async def generate(
        self,
        prop: Property,
        days_ahead: int,
        threshold: int,
        db: AsyncSession,
        cold_start_mode: str = "full",
    ) -> list[Recommendation]:
        today = date.today()
        target_dates = [today + timedelta(days=i) for i in range(days_ahead)]

        # market_only モードは DemandForecaster をスキップ（自社データ不要）
        if cold_start_mode == "market_only":
            demand_map = {d: 1.0 for d in target_dates}
        else:
            demand_map = await self._demand.forecast(
                prop.id, target_dates, prop.event_area, db
            )

        supply_map = await self._supply.analyze(prop.id, target_dates, db)

        rt_res = await db.execute(
            select(RoomType).where(RoomType.property_id == prop.id).order_by(RoomType.sort_order)
        )
        room_types = rt_res.scalars().all()

        bar_res = await db.execute(
            select(BarLadder).where(
                and_(BarLadder.property_id == prop.id, BarLadder.is_active == True)
            )
        )
        bar_ladders: dict[str, int] = {str(b.level): b.price for b in bar_res.scalars().all()}

        grid_res = await db.execute(
            select(
                PricingGrid.room_type_id,
                PricingGrid.target_date,
                PricingGrid.price,
                PricingGrid.bar_level,
            ).where(
                and_(
                    PricingGrid.property_id == prop.id,
                    PricingGrid.target_date.in_(target_dates),
                )
            )
        )
        own_prices: dict[tuple[int, date], int] = {}
        own_bar_levels: dict[tuple[int, date], int] = {}
        for row in grid_res.all():
            td = row.target_date if isinstance(row.target_date, date) else date.fromisoformat(str(row.target_date))
            own_prices[(row.room_type_id, td)] = row.price
            own_bar_levels[(row.room_type_id, td)] = int(row.bar_level)

        constraint = await self._position.evaluate(prop.id, prop.star_rating, db)
        weights = await self._weight_opt.fit(prop.id, db, cold_start_mode=cold_start_mode)

        position_map = await self._supply.price_position(
            prop.id, target_dates, own_prices, constraint.brand_target_percentile, db
        )

        total_rooms = sum(rt.total_rooms for rt in room_types)
        pace_map = await self._pace.analyze(prop.id, total_rooms or 1, target_dates, db)

        new_recs: list[Recommendation] = []

        for rt in room_types:
            for d in target_dates:
                current_level_int = own_bar_levels.get((rt.id, d), 10)
                current_price = own_prices.get((rt.id, d), bar_ladders.get("10", 12000))

                signals = SignalBundle(
                    demand_index=demand_map.get(d, 1.0),
                    supply_signal=supply_map.get(d, 0.0),
                    pace_deviation=pace_map.get(d, 0.0),
                    position_gap=position_map.get(d, 0.0),
                )

                new_level, delta = self._price_opt.optimize(
                    current_level_int, signals, weights, constraint
                )

                if delta == 0:
                    continue

                rec_price = bar_ladders.get(str(new_level), current_price)
                reason = self._build_reason(signals, delta, constraint)
                status = "pending" if abs(delta) > threshold else "auto_approved"

                rec = Recommendation(
                    property_id=prop.id,
                    room_type_id=rt.id,
                    target_date=d,
                    current_bar_level=str(current_level_int),
                    recommended_bar_level=str(new_level),
                    current_price=current_price,
                    recommended_price=rec_price,
                    delta_levels=delta,
                    reason=reason,
                    status=status,
                )
                db.add(rec)
                new_recs.append(rec)

        new_recs = self._hierarchy.apply(new_recs, list(room_types))

        return new_recs

    def _build_reason(
        self,
        signals: SignalBundle,
        delta: int,
        constraint: PositionConstraint,
    ) -> str:
        parts: list[str] = []

        if constraint.price_increase_frozen:
            parts.append("⚠️ Rating下落のため値上げ凍結中")

        if signals.demand_index >= 1.3:
            parts.append(f"需要指数高({signals.demand_index:.2f})")
        elif signals.demand_index <= 0.75:
            parts.append(f"需要指数低({signals.demand_index:.2f})")

        if signals.supply_signal >= 0.3:
            parts.append("競合価格が上昇傾向（市場圧縮）")
        elif signals.supply_signal <= -0.3:
            parts.append("競合価格が下落傾向（市場緩和）")

        if signals.pace_deviation >= 0.2:
            parts.append("予約ペースが理想を上回る")
        elif signals.pace_deviation <= -0.2:
            parts.append("予約ペースが理想を下回る")

        if signals.position_gap >= 0.3:
            parts.append("ブランドポジション目標より割安")
        elif signals.position_gap <= -0.3:
            parts.append("ブランドポジション目標より割高")

        direction = "価格引き上げ" if delta > 0 else "価格引き下げ"
        parts.append(f"{direction}推奨（±{abs(delta)}段階）")

        return "。".join(parts) if parts else "現在価格を調整"

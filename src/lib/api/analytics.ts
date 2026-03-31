import { apiFetch } from "./client";

// ---- Daily Performance ----

export interface DailyPerfOut {
  id: number;
  property_id: number;
  date: string;
  occupancy_rate: number;
  rooms_sold: number;
  total_rooms: number;
  adr: number;
  revenue: number;
  revpar: number;
  new_bookings: number;
  cancellations: number;
}

export interface DailySummaryOut {
  latest: DailyPerfOut | null;
  occ_change: number | null;
  revenue_change_pct: number | null;
  new_bookings_change_pct: number | null;
  trend_7d: DailyPerfOut[];
}

export function fetchDailySummary(propertyId: number) {
  return apiFetch<DailySummaryOut>(
    `/properties/${propertyId}/daily-performance/summary`
  );
}

export function fetchDailyPerformances(
  propertyId: number,
  params?: { date_from?: string; date_to?: string; limit?: number }
) {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params ?? {})
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, String(v)])
    ) as Record<string, string>
  ).toString();
  return apiFetch<DailyPerfOut[]>(
    `/properties/${propertyId}/daily-performance${qs ? `?${qs}` : ""}`
  );
}

// ---- Booking Curve ----

export interface CurvePointOut {
  days_before: number;
  booked_rooms: number;
  occupancy_pct: number;
  label: string;
}

export interface BookingCurveOut {
  target_date: string;
  total_rooms: number;
  points: CurvePointOut[];
  points_prev_year: CurvePointOut[];
  points_ideal: CurvePointOut[];
}

export interface MonthlyOnhandOut {
  label: string;
  year: number;
  month: number;
  revenue: number;
  revenue_change_pct: number | null;
  rooms_sold: number;
  rooms_change_pct: number | null;
  occupancy_pct: number;
  is_actual: boolean;
}

export interface BookingHeatmapOut {
  dates: string[];
  lead_times: string[];
  current_year: number[][];
  prev_year: number[][];
}

export function fetchBookingCurve(propertyId: number, targetDate?: string) {
  const qs = targetDate ? `?target_date=${targetDate}` : "";
  return apiFetch<BookingCurveOut>(
    `/properties/${propertyId}/booking-curve/${qs}`
  );
}

export function fetchMonthlyOnhand(propertyId: number, monthsAhead = 3) {
  return apiFetch<MonthlyOnhandOut[]>(
    `/properties/${propertyId}/booking-curve/monthly?months_ahead=${monthsAhead}`
  );
}

export function fetchBookingHeatmap(propertyId: number, days = 10) {
  return apiFetch<BookingHeatmapOut>(
    `/properties/${propertyId}/booking-curve/heatmap?days=${days}`
  );
}

// ---- Market Events ----

export interface MarketEventOut {
  id: string;
  name: string;
  type: string;
  date_start: string;
  date_end: string;
  date_label: string;
  venue: string;
  desc: string;
  impact: "影響大" | "影響中" | "影響小";
  icon: string;
  source: "holiday" | "seasonal";
}

export function fetchMarketEvents(propertyId: number, days = 90) {
  return apiFetch<MarketEventOut[]>(
    `/properties/${propertyId}/market/events?days=${days}`
  );
}

// ---- Overview ----

export interface OverviewAlertOut {
  type: "pending_recommendation" | "competitor_change" | "upcoming_event";
  count: number;
  message: string;
  severity: "critical" | "warning" | "info";
}

export interface WeeklyTrendPointOut {
  date: string;
  occ: number;
  adr: number;
  revpar: number;
}

export interface OverviewOut {
  today_kpi: {
    occ: number;
    occ_change: number;
    adr: number;
    adr_change: number;
    revpar: number;
    revpar_change: number;
    budget_progress: number | null;
  };
  alerts: OverviewAlertOut[];
  weekly_trend: WeeklyTrendPointOut[];
}

export function fetchOverview(propertyId: number) {
  return apiFetch<OverviewOut>(`/properties/${propertyId}/overview/`);
}

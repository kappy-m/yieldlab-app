/**
 * API クライアント
 *
 * 全リクエストは /api/proxy/* (BFF) 経由でバックエンドに転送される。
 * JWT は HttpOnly Cookie (yl_token) で管理し、localStorage には格納しない。
 */

const BFF_BASE = "/api/proxy";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BFF_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  // 401: セッション切れ → Cookie を削除してログインページへリダイレクト
  if (res.status === 401) {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ログアウト失敗しても強制遷移
    }
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("セッションが切れました。再ログインしてください。");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ---- Auth ----

export type ProductCode = "yield" | "manage" | "review" | "reservation";
export type ProductRole = "admin" | "editor" | "viewer";

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  name: string;
  role: string;
  org_id: number;
  product_roles: Record<ProductCode, ProductRole>;
}

export interface UserOut {
  id: number;
  name: string;
  email: string;
  role: string;
  org_id: number;
  product_roles: Record<ProductCode, ProductRole>;
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const form = new URLSearchParams();
  form.set("username", email);
  form.set("password", password);

  const res = await fetch(`/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? "ログインに失敗しました");
  }
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`/api/auth/logout`, { method: "POST" });
  // HttpOnly Cookie は /api/auth/logout がクリアする
  // yl_user キャッシュのみ削除（機密情報ではないため localStorage 利用継続）
  if (typeof window !== "undefined") {
    localStorage.removeItem("yl_user");
  }
}

export function fetchCurrentUser(): Promise<UserOut> {
  return apiFetch<UserOut>("/auth/me");
}

// ---- Properties ----

export interface PropertyOut {
  id: number;
  org_id: number;
  name: string;
  cm_property_code: string | null;
  brand: string | null;
  address: string | null;
  star_rating: number | null;
  total_rooms: number | null;
  checkin_time: string | null;
  checkout_time: string | null;
  website_url: string | null;
}

export function fetchProperties() {
  return apiFetch<PropertyOut[]>(`/properties/`);
}

export function fetchProperty(id: number) {
  return apiFetch<PropertyOut>(`/properties/${id}`);
}

// ---- Room Types ----

export interface RoomTypeOut {
  id: number;
  name: string;
  cm_room_type_code: string | null;
  total_rooms: number;
  sort_order: number;
}

export function fetchRoomTypes(propertyId: number) {
  return apiFetch<RoomTypeOut[]>(`/properties/${propertyId}/room-types`);
}

// ---- BAR Ladder ----

export interface BarLadderOut {
  id: number;
  level: string;
  price: number;
  label: string;
  room_type_id: number | null;
}

export function fetchBarLadder(propertyId: number) {
  return apiFetch<BarLadderOut[]>(`/properties/${propertyId}/bar-ladder`);
}

export function updateBarLadderEntry(
  propertyId: number,
  barId: number,
  price: number,
  label?: string
) {
  return apiFetch<BarLadderOut>(
    `/properties/${propertyId}/bar-ladder/${barId}`,
    { method: "PATCH", body: JSON.stringify({ price, label }) }
  );
}

export function bulkUpdateBarLadder(
  propertyId: number,
  items: { id: number; price: number; label?: string }[]
) {
  return apiFetch<BarLadderOut[]>(
    `/properties/${propertyId}/bar-ladder/bulk`,
    { method: "PUT", body: JSON.stringify({ items }) }
  );
}

export function syncGridFromBarLadder(propertyId: number) {
  return apiFetch<{ synced_rows: number; message: string }>(
    `/properties/${propertyId}/bar-ladder/sync-grid`,
    { method: "POST" }
  );
}

export interface ApprovalSettingOut {
  id: number;
  auto_approve_threshold_levels: number;
  notification_channel: string;
  notification_email: string | null;
}

export function updateApprovalSettings(
  propertyId: number,
  body: {
    auto_approve_threshold_levels?: number;
    notification_channel?: string;
    notification_email?: string;
  }
) {
  return apiFetch<ApprovalSettingOut>(
    `/properties/${propertyId}/approval-settings`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

export function fetchApprovalSettings(propertyId: number) {
  return apiFetch<ApprovalSettingOut | null>(
    `/properties/${propertyId}/approval-settings`
  );
}

// ---- Pricing Grid ----

export interface PricingCellOut {
  id: number;
  room_type_id: number;
  room_type_name: string;
  target_date: string;
  bar_level: string;
  price: number;
  available_rooms: number;
  updated_by: string;
}

export function fetchPricingGrid(
  propertyId: number,
  params?: { date_from?: string; date_to?: string }
) {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params ?? {}).filter(([, v]) => v != null)
    ) as Record<string, string>
  ).toString();
  return apiFetch<PricingCellOut[]>(
    `/properties/${propertyId}/pricing/${qs ? `?${qs}` : ""}`
  );
}

export function updatePricingCell(
  propertyId: number,
  roomTypeId: number,
  targetDate: string,
  body: { bar_level: string; price: number; available_rooms: number }
) {
  return apiFetch<PricingCellOut>(
    `/properties/${propertyId}/pricing/${roomTypeId}/${targetDate}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

// ---- Recommendations ----

export interface RecommendationOut {
  id: number;
  room_type_id: number;
  room_type_name: string;
  target_date: string;
  current_bar_level: string;
  recommended_bar_level: string;
  current_price: number;
  recommended_price: number;
  delta_levels: number;
  reason: string;
  status: string;
  needs_approval: boolean;
}

export function fetchRecommendations(propertyId: number, status?: string) {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<RecommendationOut[]>(
    `/properties/${propertyId}/recommendations/${qs}`
  );
}

export function generateRecommendations(propertyId: number, daysAhead = 30) {
  return apiFetch<RecommendationOut[]>(
    `/properties/${propertyId}/recommendations/generate?days_ahead=${daysAhead}`,
    { method: "POST" }
  );
}

export function actOnRecommendation(
  propertyId: number,
  recId: number,
  body: {
    action: "approved" | "rejected" | "modified";
    modified_bar_level?: string;
    modified_price?: number;
    note?: string;
  }
) {
  return apiFetch<RecommendationOut>(
    `/properties/${propertyId}/recommendations/${recId}/action`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

// ---- Comp Set ----

export interface CompSetOut {
  id: number;
  name: string;
  expedia_hotel_id: string | null;
  expedia_url: string | null;
  rakuten_hotel_no: string | null;
  google_place_id: string | null;
  tripadvisor_location_id: string | null;
  scrape_mode: string;
  is_active: boolean;
  sort_order: number;
}

export function fetchCompSet(propertyId: number) {
  return apiFetch<CompSetOut[]>(`/properties/${propertyId}/comp-set/`);
}

export function createCompHotel(
  propertyId: number,
  body: {
    name: string;
    expedia_hotel_id?: string;
    expedia_url?: string;
    rakuten_hotel_no?: string;
    google_place_id?: string;
    tripadvisor_location_id?: string;
    scrape_mode?: string;
    sort_order?: number;
  }
) {
  return apiFetch<CompSetOut>(`/properties/${propertyId}/comp-set/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateCompHotel(
  propertyId: number,
  compId: number,
  body: Partial<CompSetOut>
) {
  return apiFetch<CompSetOut>(
    `/properties/${propertyId}/comp-set/${compId}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

export function deleteCompHotel(propertyId: number, compId: number) {
  return apiFetch<void>(`/properties/${propertyId}/comp-set/${compId}`, {
    method: "DELETE",
  });
}

export function triggerPipeline(propertyId: number) {
  return apiFetch<{ status: string }>(`/admin/run-pipeline/${propertyId}`, {
    method: "POST",
  });
}

export interface CompetitorAvgOut {
  target_date: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  count: number;
}

export interface CompetitorPriceOut {
  id: number;
  competitor_name: string;
  target_date: string;
  price: number;
  available_rooms: number | null;
  scraped_at: string;
}

export function fetchCompetitorPrices(
  propertyId: number,
  params?: { date_from?: string; date_to?: string; competitor_name?: string }
) {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params ?? {}).filter(([, v]) => v != null)
    ) as Record<string, string>
  ).toString();
  return apiFetch<CompetitorPriceOut[]>(
    `/properties/${propertyId}/competitor/prices${qs ? `?${qs}` : ""}`
  );
}

export function fetchCompetitorAverages(
  propertyId: number,
  params?: { date_from?: string; date_to?: string }
) {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params ?? {}).filter(([, v]) => v != null)
    ) as Record<string, string>
  ).toString();
  return apiFetch<CompetitorAvgOut[]>(
    `/properties/${propertyId}/competitor/averages${qs ? `?${qs}` : ""}`
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

// ---- Competitor Ratings ----

export interface RatingCategoryOut {
  service: number | null;
  location: number | null;
  room: number | null;
  equipment: number | null;
  bath: number | null;
  meal: number | null;
}

export interface CompetitorRatingOut {
  id: number;
  hotel_name: string;
  rakuten_no: string | null;
  source: "rakuten" | "google" | "tripadvisor";
  overall: number | null;
  review_count: number | null;
  categories: RatingCategoryOut;
  user_review: string | null;
  review_url: string | null;
  review_date: string | null;
  is_own_property: boolean;
  fetched_at: string;
}

export function fetchCompetitorRatings(propertyId: number) {
  return apiFetch<CompetitorRatingOut[]>(
    `/properties/${propertyId}/competitor-ratings/`
  );
}

export function refreshCompetitorRatings(propertyId: number) {
  return apiFetch<{ status: string; targets: number }>(
    `/properties/${propertyId}/competitor-ratings/refresh`,
    { method: "POST" }
  );
}

export function updatePropertySettings(
  propertyId: number,
  data: { own_rakuten_hotel_no?: string | null }
) {
  return apiFetch<{ id: number; own_rakuten_hotel_no: string | null }>(
    `/properties/${propertyId}/settings`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

export function updatePropertySettingsFull(
  propertyId: number,
  data: { own_rakuten_hotel_no?: string | null; event_area?: string }
) {
  return apiFetch<{
    id: number;
    own_rakuten_hotel_no: string | null;
    event_area: string;
  }>(`/properties/${propertyId}/settings`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
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

// ---- Cost / Budget ----

export interface CostSettingOut {
  id: number;
  property_id: number;
  cost_category: string;
  amount_per_room_night: number;
  fixed_monthly: number;
}

export interface BudgetTargetOut {
  id: number;
  property_id: number;
  year: number;
  month: number;
  target_occupancy: number | null;
  target_adr: number | null;
  target_revpar: number | null;
  target_revenue: number | null;
}

export interface CostSummaryOut {
  year: number;
  month: number;
  total_revenue: number;
  total_rooms_sold: number;
  avg_occupancy: number;
  avg_adr: number;
  variable_cost_total: number;
  fixed_cost_total: number;
  total_cost: number;
  goppar: number;
  total_rooms: number;
  budget: BudgetTargetOut | null;
  budget_occupancy_rate: number | null;
  budget_revenue_rate: number | null;
}

export function fetchCosts(propertyId: number) {
  return apiFetch<CostSettingOut[]>(`/properties/${propertyId}/costs`);
}

export function createCost(
  propertyId: number,
  body: {
    cost_category: string;
    amount_per_room_night: number;
    fixed_monthly: number;
  }
) {
  return apiFetch<CostSettingOut>(`/properties/${propertyId}/costs`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateCost(
  propertyId: number,
  costId: number,
  body: { amount_per_room_night?: number; fixed_monthly?: number }
) {
  return apiFetch<CostSettingOut>(
    `/properties/${propertyId}/costs/${costId}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

export function deleteCost(propertyId: number, costId: number) {
  return apiFetch<void>(`/properties/${propertyId}/costs/${costId}`, {
    method: "DELETE",
  });
}

export function fetchBudget(propertyId: number, year?: number) {
  const qs = year ? `?year=${year}` : "";
  return apiFetch<BudgetTargetOut[]>(`/properties/${propertyId}/budget${qs}`);
}

export function upsertBudget(
  propertyId: number,
  body: {
    year: number;
    month: number;
    target_occupancy?: number | null;
    target_adr?: number | null;
    target_revpar?: number | null;
    target_revenue?: number | null;
  }
) {
  return apiFetch<BudgetTargetOut>(`/properties/${propertyId}/budget`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchCostSummary(propertyId: number, months = 3) {
  return apiFetch<CostSummaryOut[]>(
    `/properties/${propertyId}/cost-summary?months=${months}`
  );
}

// ---- Pricing Export ----

export function getPricingExportUrl(
  propertyId: number,
  dateFrom?: string,
  dateTo?: string
): string {
  // BFF 経由でエクスポートURLを構築
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  return `${BFF_BASE}/properties/${propertyId}/pricing/export${qs ? `?${qs}` : ""}`;
}

// ---- Pricing AI Summary ----

export interface PricingAiSummaryOut {
  summary: string;
  bullets: string[];
}

export function fetchPricingAiSummary(propertyId: number) {
  return apiFetch<PricingAiSummaryOut>(
    `/properties/${propertyId}/pricing/ai-summary`
  );
}

// ---- User Management ----

export interface UserManageOut {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  product_roles: Partial<Record<ProductCode, ProductRole>>;
}

export function fetchUsers(): Promise<UserManageOut[]> {
  return apiFetch<UserManageOut[]>("/users/");
}

export function createUser(data: {
  email: string;
  name: string;
  password: string;
  role?: string;
  product_roles?: Partial<Record<ProductCode, ProductRole>>;
}): Promise<UserManageOut> {
  return apiFetch<UserManageOut>("/users/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateUser(
  userId: number,
  data: { name?: string; role?: string; is_active?: boolean; password?: string }
): Promise<UserManageOut> {
  return apiFetch<UserManageOut>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteUser(userId: number): Promise<void> {
  return apiFetch<void>(`/users/${userId}`, { method: "DELETE" });
}

export function setUserProductRoles(
  userId: number,
  roles: Array<{ product_code: ProductCode; role: ProductRole }>
): Promise<UserManageOut> {
  return apiFetch<UserManageOut>(`/users/${userId}/product-roles`, {
    method: "PUT",
    body: JSON.stringify(roles),
  });
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

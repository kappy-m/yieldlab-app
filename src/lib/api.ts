// ブラウザ: NEXT_PUBLIC_API_URL（本番）/ SSR時: rewrite経由で /api/backend に流す
const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8400")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8400");

export const PROPERTY_ID = 1; // シードで生成される property_id

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
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

export function updateBarLadderEntry(propertyId: number, barId: number, price: number, label?: string) {
  return apiFetch<BarLadderOut>(`/properties/${propertyId}/bar-ladder/${barId}`, {
    method: "PATCH",
    body: JSON.stringify({ price, label }),
  });
}

export function bulkUpdateBarLadder(
  propertyId: number,
  items: { id: number; price: number; label?: string }[]
) {
  return apiFetch<BarLadderOut[]>(`/properties/${propertyId}/bar-ladder/bulk`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

export function syncGridFromBarLadder(propertyId: number) {
  return apiFetch<{ synced_rows: number; message: string }>(
    `/properties/${propertyId}/bar-ladder/sync-grid`,
    { method: "POST" }
  );
}

export function updateApprovalSettings(
  propertyId: number,
  body: { auto_approve_threshold_levels?: number; notification_channel?: string; notification_email?: string }
) {
  return apiFetch<ApprovalSettingOut>(`/properties/${propertyId}/approval-settings`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export interface ApprovalSettingOut {
  id: number;
  auto_approve_threshold_levels: number;
  notification_channel: string;
  notification_email: string | null;
}

export function fetchApprovalSettings(propertyId: number) {
  return apiFetch<ApprovalSettingOut | null>(`/properties/${propertyId}/approval-settings`);
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
    Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null)) as Record<string, string>
  ).toString();
  return apiFetch<PricingCellOut[]>(`/properties/${propertyId}/pricing/${qs ? `?${qs}` : ""}`);
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
  return apiFetch<RecommendationOut[]>(`/properties/${propertyId}/recommendations/${qs}`);
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

// ---- Competitor Prices ----

export interface CompetitorAvgOut {
  target_date: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  count: number;
}

// ---- Comp Set ----

export interface CompSetOut {
  id: number;
  name: string;
  expedia_hotel_id: string | null;
  expedia_url: string | null;
  rakuten_hotel_no: string | null;
  scrape_mode: string;   // "mock" | "rakuten" | "live"
  is_active: boolean;
  sort_order: number;
}

export function fetchCompSet(propertyId: number) {
  return apiFetch<CompSetOut[]>(`/properties/${propertyId}/comp-set/`);
}

export function createCompHotel(propertyId: number, body: {
  name: string;
  expedia_hotel_id?: string;
  expedia_url?: string;
  scrape_mode?: string;
  sort_order?: number;
}) {
  return apiFetch<CompSetOut>(`/properties/${propertyId}/comp-set/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateCompHotel(propertyId: number, compId: number, body: Partial<CompSetOut>) {
  return apiFetch<CompSetOut>(`/properties/${propertyId}/comp-set/${compId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteCompHotel(propertyId: number, compId: number) {
  return apiFetch<void>(`/properties/${propertyId}/comp-set/${compId}`, { method: "DELETE" });
}

export function triggerPipeline(propertyId: number) {
  return apiFetch<{ status: string }>(`/admin/run-pipeline/${propertyId}`, { method: "POST" });
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
    Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null)) as Record<string, string>
  ).toString();
  return apiFetch<CompetitorPriceOut[]>(`/properties/${propertyId}/competitor/prices${qs ? `?${qs}` : ""}`);
}

// ---- Competitor Prices ----

export function fetchCompetitorAverages(
  propertyId: number,
  params?: { date_from?: string; date_to?: string }
) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null)) as Record<string, string>
  ).toString();
  return apiFetch<CompetitorAvgOut[]>(`/properties/${propertyId}/competitor/averages${qs ? `?${qs}` : ""}`);
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
  return apiFetch<MarketEventOut[]>(`/properties/${propertyId}/market/events?days=${days}`);
}

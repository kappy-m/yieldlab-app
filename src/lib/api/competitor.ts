import { apiFetch } from "./client";

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

// ---- Competitor Prices ----

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

// ---- Lead-time Curves ----

export interface LeadTimeCurvePoint {
  days_before: number;
  avg_price: number;
  sample_count: number;
}

export type CompetitorStrategy =
  | "premium_holder"
  | "demand_follower"
  | "last_minute_discounter"
  | "stable_pricer"
  | "insufficient_data";

export interface LeadTimeCurveOut {
  competitor_name: string;
  curves: LeadTimeCurvePoint[];
  strategy: CompetitorStrategy;
  total_samples: number;
}

export function fetchLeadTimeCurves(
  propertyId: number,
  params?: { date_from?: string; date_to?: string }
) {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params ?? {}).filter(([, v]) => v != null)
    ) as Record<string, string>
  ).toString();
  return apiFetch<LeadTimeCurveOut[]>(
    `/properties/${propertyId}/competitor/lead-time${qs ? `?${qs}` : ""}`
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

import { apiFetch, BFF_BASE } from "./client";

// ---- Approval Settings ----

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

export function generateRecommendations(propertyId: number, daysAhead = 30, useV2 = true) {
  const qs = new URLSearchParams({
    days_ahead: String(daysAhead),
    use_v2: String(useV2),
  }).toString();
  return apiFetch<RecommendationOut[]>(
    `/properties/${propertyId}/recommendations/generate?${qs}`,
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

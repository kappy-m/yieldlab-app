import { apiFetch } from "./client";

// ---- Cost Settings ----

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

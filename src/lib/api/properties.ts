import { apiFetch } from "./client";

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

// ---- Algorithm Settings ----

export interface AlgorithmSettings {
  cold_start_mode: "full" | "market_only";
  use_v2_engine: boolean;
}

export function fetchAlgorithmSettings(propertyId: number) {
  return apiFetch<AlgorithmSettings>(
    `/properties/${propertyId}/algorithm-settings`
  );
}

export function updateAlgorithmSettings(
  propertyId: number,
  data: Partial<AlgorithmSettings>
) {
  return apiFetch<AlgorithmSettings>(
    `/properties/${propertyId}/algorithm-settings`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

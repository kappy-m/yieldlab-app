import { apiFetch } from "./client";

// ---- Reservations ----

export interface ReservationOut {
  id: number;
  property_id: number;
  reservation_no: string;
  ota_channel: string | null;
  booking_date: string;
  guest_name: string;
  guest_name_kana: string | null;
  guest_email: string | null;
  guest_count: number;
  nationality: string | null;
  checkin_date: string;
  checkout_date: string;
  nights: number;
  room_type: string | null;
  plan_name: string | null;
  total_amount: number | null;
  currency: string;
  status: string;
  is_group: boolean;
}

export interface ReservationListOut {
  items: ReservationOut[];
  total: number;
  monthly_counts: Record<string, number>;
}

export function fetchReservations(
  propertyId: number,
  params?: Record<string, string>
) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch<ReservationListOut>(`/properties/${propertyId}/reservations${qs}`);
}

export function updateReservationStatus(
  propertyId: number,
  reservationId: number,
  status: string
) {
  return apiFetch<ReservationOut>(`/properties/${propertyId}/reservations/${reservationId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

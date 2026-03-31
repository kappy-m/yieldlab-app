import { apiFetch } from "./client";

// ---- Guest Stays (Front Desk) ----

export interface GuestStayOut {
  id: number;
  property_id: number;
  reservation_no: string;
  ota_channel: string | null;
  guest_name: string;
  guest_name_kana: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  guest_count: number;
  nationality: string | null;
  room_number: string | null;
  room_type: string | null;
  floor: number | null;
  checkin_date: string;
  checkout_date: string;
  nights: number;
  status: string;
  checkin_time: string | null;
  checkout_time: string | null;
  plan_name: string | null;
  special_requests: string | null;
  is_repeat: boolean;
}

export interface GuestStayListOut {
  items: GuestStayOut[];
  total: number;
  today_checkin: number;
  today_checkout: number;
  today_inhouse: number;
}

export function fetchGuestStays(
  propertyId: number,
  params?: Record<string, string>
) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch<GuestStayListOut>(`/properties/${propertyId}/front/stays${qs}`);
}

export function updateGuestStayStatus(
  propertyId: number,
  stayId: number,
  status: string,
  room_number?: string
) {
  return apiFetch<GuestStayOut>(`/properties/${propertyId}/front/stays/${stayId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, room_number }),
  });
}

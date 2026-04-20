import { apiFetch } from "./client";

// ---- Types ----

export interface MessageOut {
  id: number;
  direction: "inbound" | "outbound";
  text: string;
  detected_language: string;
  translated_text: string | null;
  created_at: string;
}

export interface ConversationSummaryOut {
  id: number;
  guest_name: string;
  guest_email: string | null;
  room_no: string | null;
  detected_language: string;
  status: "open" | "pending" | "resolved";
  assignee_id: number | null;
  assignee_name: string | null;
  unread_count: number;
  last_message_preview: string | null;
  last_message_at: string;
}

export interface ConversationDetailOut {
  id: number;
  guest_name: string;
  guest_email: string | null;
  room_no: string | null;
  detected_language: string;
  status: "open" | "pending" | "resolved";
  assignee_id: number | null;
  assignee_name: string | null;
  unread_count: number;
  last_message_at: string;
  messages: MessageOut[];
}

export interface ConversationListOut {
  items: ConversationSummaryOut[];
  total: number;
  unread_total: number;
}

export interface AiDraftOut {
  draft: string;
  model: string;
  fallback: boolean;
}

// ---- API functions ----

export function fetchConversations(propertyId: number) {
  return apiFetch<ConversationListOut>(`/properties/${propertyId}/conversations/`);
}

export function fetchConversation(propertyId: number, conversationId: number) {
  return apiFetch<ConversationDetailOut>(`/properties/${propertyId}/conversations/${conversationId}`);
}

export function markConversationRead(propertyId: number, conversationId: number) {
  return apiFetch<{ ok: boolean }>(`/properties/${propertyId}/conversations/${conversationId}/read`, {
    method: "PATCH",
  });
}

export function sendConversationMessage(
  propertyId: number,
  conversationId: number,
  text: string,
  direction: "inbound" | "outbound" = "outbound"
) {
  return apiFetch<MessageOut>(`/properties/${propertyId}/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text, direction }),
  });
}

export function generateConversationAiDraft(propertyId: number, conversationId: number) {
  return apiFetch<AiDraftOut>(`/properties/${propertyId}/conversations/${conversationId}/ai-draft`, {
    method: "POST",
  });
}

export function updateConversationAssignee(
  propertyId: number,
  conversationId: number,
  assigneeId: number | null
) {
  return apiFetch<{ ok: boolean }>(`/properties/${propertyId}/conversations/${conversationId}/assignee`, {
    method: "PATCH",
    body: JSON.stringify({ assignee_id: assigneeId }),
  });
}

export function updateConversationStatus(
  propertyId: number,
  conversationId: number,
  status: "open" | "pending" | "resolved"
) {
  return apiFetch<{ ok: boolean }>(`/properties/${propertyId}/conversations/${conversationId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

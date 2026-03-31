import { apiFetch } from "./client";

// ---- Review / Inquiry ----

export interface ReviewOut {
  id: number;
  platform: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  language: string;
  responded: boolean;
  response?: string;
}

export interface ReviewListOut {
  items: ReviewOut[];
  total: number;
  unresponded: number;
}

export interface InquiryOut {
  id: number;
  channel: string;
  status: string;
  priority: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  subject: string;
  content: string;
  date: string;
  language: string;
  assignee?: string;
  tags: string[];
  response?: string;
}

export interface InquiryListOut {
  items: InquiryOut[];
  total: number;
  new_count: number;
}

export function fetchReviews(propertyId: number, params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch<ReviewListOut>(`/properties/${propertyId}/reviews${qs}`);
}

export function respondToReview(propertyId: number, reviewId: number, response: string) {
  return apiFetch<ReviewOut>(`/properties/${propertyId}/reviews/${reviewId}/respond`, {
    method: "POST",
    body: JSON.stringify({ response }),
  });
}

export function fetchInquiries(propertyId: number, params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch<InquiryListOut>(`/properties/${propertyId}/inquiries${qs}`);
}

export function respondToInquiry(propertyId: number, inquiryId: number, response: string) {
  return apiFetch<InquiryOut>(`/properties/${propertyId}/inquiries/${inquiryId}/respond`, {
    method: "POST",
    body: JSON.stringify({ response }),
  });
}

export function updateInquiryStatus(
  propertyId: number,
  inquiryId: number,
  status: string,
  assignee?: string
) {
  return apiFetch<InquiryOut>(`/properties/${propertyId}/inquiries/${inquiryId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, assignee }),
  });
}

// ---- AI Reply ----

export interface AiReplyRequest {
  content_type: "review" | "inquiry";
  content: string;
  language?: "ja" | "en" | "zh" | "ko" | "de";
  platform?: string;
  rating?: number;
  hotel_name?: string;
}

export interface AiReplyResponse {
  reply: string;
  model: string;
  fallback: boolean;
}

export function generateAiReply(req: AiReplyRequest) {
  return apiFetch<AiReplyResponse>("/ai/reply", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

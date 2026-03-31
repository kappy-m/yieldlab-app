import { apiFetch } from "./client";

// ---- Mail ----

export interface SendMailRequest {
  to_email: string;
  to_name?: string;
  subject: string;
  body: string;
  reply_to?: string;
  inquiry_id?: number;
}

export interface SendMailResponse {
  message_id: string | null;
  status: "sent" | "failed" | "simulated";
  detail: string;
}

export function sendMail(req: SendMailRequest) {
  return apiFetch<SendMailResponse>("/mail/send", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

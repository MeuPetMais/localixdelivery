// Tipos do módulo de pagamentos (Prompt 1 — apenas estrutura).
// Não faz integração com gateway; apenas descreve o formato dos dados.

export type PaymentMethod = "pix" | "credit_card" | "debit_card";

export type PaymentStatus =
  | "pending"
  | "in_process"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export interface MercadoPagoAccount {
  id: string;
  restaurant_id: string;
  mp_user_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  public_key: string | null;
  scope: string | null;
  live_mode: boolean;
  connected: boolean;
  expires_at: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  raw: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string | null;
  restaurant_id: string;
  provider: string;
  external_id: string | null;
  method: PaymentMethod | string;
  status: PaymentStatus | string;
  amount: number;
  platform_fee: number;
  net_amount: number;
  currency: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  payer_email: string | null;
  paid_at: string | null;
  raw: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformFees {
  id: true;
  min_order: number;
  fee_up_to_30: number;
  fee_above_30: number;
  monthly_fee: number;
  updated_at: string;
}

export interface PaymentLog {
  id: string;
  payment_id: string | null;
  restaurant_id: string | null;
  level: "info" | "warn" | "error" | string;
  message: string;
  data: unknown | null;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  source: string;
  event_type: string | null;
  external_id: string | null;
  payload: unknown;
  processed_at: string | null;
  error: string | null;
  created_at: string;
}

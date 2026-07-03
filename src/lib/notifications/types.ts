// Notification Center — tipos e enums

export type NotificationChannel =
  | "IN_APP"
  | "PUSH"
  | "EMAIL"
  | "SMS"
  | "WHATSAPP"
  | "WEBSOCKET";

export type NotificationStatus =
  | "PENDING"
  | "PROCESSING"
  | "SENT"
  | "FAILED"
  | "RETRY"
  | "DEAD_LETTER";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type NotificationRecipientType =
  | "customer"
  | "restaurant"
  | "admin"
  | "courier"
  | "system";

export interface NotificationTemplate {
  code: string;
  channel: NotificationChannel;
  language: string;
  subject?: string | null;
  title?: string | null;
  body: string;
  variables: string[];
  enabled: boolean;
}

export interface NotificationPreferences {
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  in_app_enabled: boolean;
  marketing_enabled: boolean;
  quiet_hours_start?: number | null;
  quiet_hours_end?: number | null;
}

export interface NotificationRequest {
  recipient_id: string | null;
  recipient_type?: NotificationRecipientType;
  template_code: string;
  channel?: NotificationChannel;
  priority?: NotificationPriority;
  language?: string;
  payload?: Record<string, unknown>;
  scheduled_at?: string;
  origin?: string;
}

export interface NotificationRecord {
  id: string;
  recipient_id: string | null;
  recipient_type: NotificationRecipientType;
  channel: NotificationChannel;
  template_code: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  payload_json: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  sent_at: string | null;
  read_at: string | null;
  error_message: string | null;
  origin: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationRenderResult {
  subject: string | null;
  title: string | null;
  body: string;
}

export interface ProviderSendResult {
  ok: boolean;
  status: NotificationStatus;
  response?: Record<string, unknown>;
  error_message?: string;
  execution_time?: number;
}

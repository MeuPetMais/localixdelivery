// Customer CRM Domain — shared types.

export type CustomerStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

export type CustomerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  avatar_url: string | null;
  provider: string | null;
  status?: CustomerStatus;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
};

export type CustomerPreferences = {
  customer_id: string;
  preferred_payment_method: string | null;
  preferred_channel: string | null;
  preferred_category: string | null;
  dietary_restrictions: string[];
  language: string;
  marketing_opt_in: boolean;
  push_opt_in: boolean;
  email_opt_in: boolean;
  whatsapp_opt_in: boolean;
};

export type CustomerConsentType = "LGPD_TERMS" | "MARKETING" | "NOTIFICATIONS";

export type CustomerConsent = {
  id: string;
  customer_id: string;
  consent_type: CustomerConsentType;
  granted: boolean;
  source?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type CustomerTimelineEventType =
  | "REGISTERED"
  | "FIRST_ORDER"
  | "LAST_ORDER"
  | "ADDRESS_ADDED"
  | "ADDRESS_CHANGED"
  | "FAVORITE_ADDED"
  | "COUPON_REDEEMED"
  | "CASHBACK_EARNED"
  | "CASHBACK_REDEEMED"
  | "REVIEW_SUBMITTED"
  | "NOTIFICATION_RECEIVED"
  | "PREFERENCE_CHANGED"
  | "CONSENT_UPDATED";

export type CustomerTimelineEvent = {
  id: string;
  customer_id: string;
  restaurant_id?: string | null;
  event_type: CustomerTimelineEventType;
  reference_type?: string | null;
  reference_id?: string | null;
  description?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CustomerValidationIssue = { field: string; message: string };
export type CustomerValidationResult = { ok: boolean; issues: CustomerValidationIssue[] };

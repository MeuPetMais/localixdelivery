// Customer Communication Center — types

export type CommunicationChannel =
  | "EMAIL"
  | "PUSH"
  | "SMS"
  | "WHATSAPP"
  | "IN_APP";

export type CommunicationStatus =
  | "logged"
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "read"
  | "opt_in"
  | "opt_out";

export interface CommunicationPreferences {
  customer_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  in_app_enabled: boolean;
  marketing_enabled: boolean;
}

export interface CommunicationHistoryEntry {
  id?: string;
  customer_id: string;
  channel: CommunicationChannel;
  event_type: string;
  status?: CommunicationStatus;
  reference_id?: string | null;
  metadata_json?: Record<string, unknown>;
  created_at?: string;
}

export interface CommunicationHistoryFilter {
  channel?: CommunicationChannel;
  status?: CommunicationStatus;
  event_type?: string;
  from?: string;
  to?: string;
  segment?: string;
  limit?: number;
  offset?: number;
}

export type CommunicationEvent =
  | { type: "CommunicationPreferenceChanged"; customerId: string; changes: Partial<CommunicationPreferences>; at: string }
  | { type: "CustomerOptedIn"; customerId: string; channel: CommunicationChannel; at: string }
  | { type: "CustomerOptedOut"; customerId: string; channel: CommunicationChannel; at: string }
  | { type: "CampaignAudienceGenerated"; campaignId: string; size: number; segment?: string; at: string }
  | { type: "CommunicationLogged"; customerId: string; channel: CommunicationChannel; event_type: string; at: string };

export interface CampaignAudienceInput {
  restaurant_id: string;
  segment?: string;
  channel: CommunicationChannel;
  require_marketing_consent?: boolean;
  customer_ids?: string[];
}

export interface CampaignAudienceResult {
  campaign_id: string;
  channel: CommunicationChannel;
  segment?: string;
  size: number;
  customer_ids: string[];
  filtered_out: number;
}

export interface CampaignPreviewResult {
  estimated_reach: number;
  eligible_by_channel: Record<CommunicationChannel, number>;
  segments: Record<string, number>;
}

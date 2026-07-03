// Marketing Automation Platform — types
import type { CommunicationChannel } from "@/lib/customer/communication/types";
import type { CustomerSegment } from "@/lib/customer/intelligence/types";

export type CampaignType =
  | "SEGMENT"
  | "PRODUCT"
  | "CATEGORY"
  | "LOYALTY"
  | "CASHBACK"
  | "COUPON"
  | "SPECIAL_DATE"
  | "FIRST_PURCHASE"
  | "INACTIVE"
  | "VIP"
  | "BIRTHDAY"
  | "CART_RECOVERY"
  | "REPURCHASE";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "cancelled";

export type AutomationTrigger =
  | "WELCOME"
  | "POST_PURCHASE"
  | "REPURCHASE"
  | "INACTIVE"
  | "LEVEL_CHANGED"
  | "CASHBACK_AVAILABLE"
  | "COUPON_AVAILABLE"
  | "BIRTHDAY";

export interface AudienceFilter {
  segment?: CustomerSegment;
  customer_ids?: string[];
  require_marketing_consent?: boolean;
  min_orders?: number;
  min_spent?: number;
}

export interface Campaign {
  id: string;
  restaurant_id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  channels: CommunicationChannel[];
  audience: AudienceFilter;
  template_id?: string;
  scheduled_at?: string;
  starts_at?: string;
  ends_at?: string;
  ab_test?: ABTestConfig;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CampaignInput {
  restaurant_id: string;
  name: string;
  type: CampaignType;
  channels: CommunicationChannel[];
  audience: AudienceFilter;
  template_id?: string;
  scheduled_at?: string;
  ab_test?: ABTestConfig;
  metadata?: Record<string, unknown>;
}

export interface ABTestConfig {
  variants: Array<{ key: string; template_id?: string; weight: number; metadata?: Record<string, unknown> }>;
}

export interface Automation {
  id: string;
  restaurant_id: string;
  name: string;
  trigger: AutomationTrigger;
  channels: CommunicationChannel[];
  template_id?: string;
  delay_minutes?: number;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AutomationInput {
  restaurant_id: string;
  name: string;
  trigger: AutomationTrigger;
  channels: CommunicationChannel[];
  template_id?: string;
  delay_minutes?: number;
  active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CampaignTemplate {
  id: string;
  restaurant_id?: string;
  name: string;
  type: CampaignType;
  channels: CommunicationChannel[];
  subject?: string;
  body: string;
  metadata: Record<string, unknown>;
}

export interface JourneyStep {
  id: string;
  trigger?: AutomationTrigger;
  wait_minutes?: number;
  channels?: CommunicationChannel[];
  template_id?: string;
  condition?: string;
  next?: string[];
}

export interface Journey {
  id: string;
  restaurant_id: string;
  name: string;
  entry: string;
  steps: Record<string, JourneyStep>;
  active: boolean;
  created_at: string;
}

export interface CampaignMetrics {
  campaign_id: string;
  audience_size: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  revenue: number;
  coupon_uses: number;
  roi: number;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
}

export interface CampaignDispatchResult {
  campaign_id: string;
  audience_size: number;
  scheduled: number;
  channels: CommunicationChannel[];
  variants?: Record<string, number>;
}

export type MarketingDomainEvent =
  | { type: "CampaignCreated"; campaignId: string; restaurantId: string; at: string }
  | { type: "CampaignScheduled"; campaignId: string; scheduledAt: string; at: string }
  | { type: "CampaignLaunched"; campaignId: string; audienceSize: number; at: string }
  | { type: "CampaignPaused"; campaignId: string; at: string }
  | { type: "CampaignCompleted"; campaignId: string; at: string }
  | { type: "AutomationTriggered"; automationId: string; trigger: AutomationTrigger; customerId: string; at: string }
  | { type: "JourneyStarted"; journeyId: string; customerId: string; at: string };

import { supabase } from "@/integrations/supabase/client";
import { CommunicationEventBus } from "./CommunicationEventBus";
import type {
  CampaignAudienceInput,
  CampaignAudienceResult,
  CampaignPreviewResult,
  CommunicationChannel,
} from "./types";
import { CommunicationPreferenceService } from "./CommunicationPreferenceService";

/**
 * CampaignAudienceService — resolves eligible customers for a campaign.
 * Reuses `customer_segments` (Intelligence) and `customer_communication_preferences`.
 * Never sends messages: only produces audience metadata for NotificationCenter.
 */
export const CampaignAudienceService = {
  async candidateIds(input: CampaignAudienceInput): Promise<string[]> {
    if (input.customer_ids?.length) return [...new Set(input.customer_ids)];
    const { data, error } = await (supabase as any)
      .from("customer_segments")
      .select("customer_id, primary_segment")
      .eq("restaurant_id", input.restaurant_id);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ customer_id: string; primary_segment: string | null }>;
    const filtered = input.segment
      ? rows.filter((r) => r.primary_segment === input.segment)
      : rows;
    return filtered.map((r) => r.customer_id);
  },

  async filterByConsent(customerIds: string[], channel: CommunicationChannel, requireMarketing = true) {
    if (customerIds.length === 0) return { eligible: [] as string[], filtered_out: 0 };
    const { data, error } = await (supabase as any)
      .from("customer_communication_preferences")
      .select("*")
      .in("customer_id", customerIds);
    if (error) throw error;
    const map = new Map<string, any>((data ?? []).map((r: any) => [r.customer_id, r]));
    const eligible: string[] = [];
    for (const id of customerIds) {
      const prefs = map.get(id) ?? CommunicationPreferenceService.defaults(id);
      if (CommunicationPreferenceService.isAllowed(prefs, channel, { marketing: requireMarketing })) {
        eligible.push(id);
      }
    }
    return { eligible, filtered_out: customerIds.length - eligible.length };
  },

  async build(input: CampaignAudienceInput & { campaign_id?: string }): Promise<CampaignAudienceResult> {
    const candidates = await CampaignAudienceService.candidateIds(input);
    const { eligible, filtered_out } = await CampaignAudienceService.filterByConsent(
      candidates,
      input.channel,
      input.require_marketing_consent ?? true,
    );
    const result: CampaignAudienceResult = {
      campaign_id: input.campaign_id ?? crypto.randomUUID(),
      channel: input.channel,
      segment: input.segment,
      size: eligible.length,
      customer_ids: eligible,
      filtered_out,
    };
    await CommunicationEventBus.publish({
      type: "CampaignAudienceGenerated",
      campaignId: result.campaign_id,
      size: result.size,
      segment: input.segment,
      at: new Date().toISOString(),
    });
    return result;
  },
} as const;

export const CampaignPreview = {
  async estimate(input: CampaignAudienceInput): Promise<CampaignPreviewResult> {
    const candidates = await CampaignAudienceService.candidateIds(input);
    const channels: CommunicationChannel[] = ["EMAIL", "PUSH", "SMS", "WHATSAPP", "IN_APP"];
    const eligible_by_channel = {} as Record<CommunicationChannel, number>;
    for (const c of channels) {
      const { eligible } = await CampaignAudienceService.filterByConsent(
        candidates, c, input.require_marketing_consent ?? true,
      );
      eligible_by_channel[c] = eligible.length;
    }
    const { data } = await (supabase as any)
      .from("customer_segments")
      .select("primary_segment")
      .eq("restaurant_id", input.restaurant_id);
    const segments: Record<string, number> = {};
    for (const r of (data ?? []) as Array<{ primary_segment: string | null }>) {
      const k = r.primary_segment ?? "UNKNOWN";
      segments[k] = (segments[k] ?? 0) + 1;
    }
    return {
      estimated_reach: eligible_by_channel[input.channel] ?? 0,
      eligible_by_channel,
      segments,
    };
  },
} as const;

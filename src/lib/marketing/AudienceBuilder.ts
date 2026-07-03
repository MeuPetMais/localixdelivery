import type { AudienceFilter, Campaign } from "./types";
import type { CommunicationChannel } from "@/lib/customer/communication/types";

export interface AudienceCandidate {
  customer_id: string;
  segment?: string;
  marketing_consent?: boolean;
  channels?: Record<CommunicationChannel, boolean>;
  total_orders?: number;
  total_spent?: number;
}

export interface AudienceResolution {
  campaign_id: string;
  size: number;
  customer_ids: string[];
  filtered_out: number;
  reasons: Record<string, number>;
}

/**
 * Pure audience resolver. Filters candidates according to campaign audience filter
 * and per-channel consent. Never queries DB — consumes candidates from CustomerIntelligence.
 */
export const AudienceBuilder = {
  resolve(
    campaign: Pick<Campaign, "id" | "audience" | "channels">,
    candidates: AudienceCandidate[],
  ): AudienceResolution {
    const reasons: Record<string, number> = { segment: 0, consent: 0, channel: 0, orders: 0, spent: 0, explicit: 0 };
    const { audience, channels } = campaign;
    const explicit = audience.customer_ids ? new Set(audience.customer_ids) : null;
    const out: string[] = [];

    for (const c of candidates) {
      if (explicit && !explicit.has(c.customer_id)) { reasons.explicit++; continue; }
      if (audience.segment && c.segment !== audience.segment) { reasons.segment++; continue; }
      if (audience.require_marketing_consent !== false && c.marketing_consent === false) { reasons.consent++; continue; }
      if (audience.min_orders != null && (c.total_orders ?? 0) < audience.min_orders) { reasons.orders++; continue; }
      if (audience.min_spent != null && (c.total_spent ?? 0) < audience.min_spent) { reasons.spent++; continue; }
      if (c.channels && !channels.some((ch) => c.channels?.[ch])) { reasons.channel++; continue; }
      out.push(c.customer_id);
    }

    return {
      campaign_id: campaign.id,
      size: out.length,
      customer_ids: out,
      filtered_out: candidates.length - out.length,
      reasons,
    };
  },
} as const;

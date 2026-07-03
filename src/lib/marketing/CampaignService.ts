import type {
  Campaign, CampaignDispatchResult, CampaignInput, CampaignStatus,
} from "./types";
import type { AudienceCandidate } from "./AudienceBuilder";
import { AudienceBuilder } from "./AudienceBuilder";
import { ABTestingEngine } from "./ABTestingEngine";
import { CampaignSchedulerService } from "./CampaignSchedulerService";
import { MarketingEventBus } from "./MarketingEventBus";
import { MarketingAudit } from "./MarketingAudit";

const store = new Map<string, Campaign>();
let seq = 0;

function touch(c: Campaign): Campaign { c.updated_at = new Date().toISOString(); return c; }

function transition(c: Campaign, to: CampaignStatus): void {
  const allowed: Record<CampaignStatus, CampaignStatus[]> = {
    draft: ["scheduled", "running", "cancelled"],
    scheduled: ["running", "cancelled", "paused"],
    running: ["paused", "completed", "cancelled"],
    paused: ["running", "cancelled"],
    completed: [],
    cancelled: [],
  };
  if (!allowed[c.status].includes(to)) {
    throw new Error(`Invalid campaign transition ${c.status} → ${to}`);
  }
  c.status = to;
  touch(c);
}

export const CampaignService = {
  async create(input: CampaignInput): Promise<Campaign> {
    const now = new Date().toISOString();
    const c: Campaign = {
      id: `cmp_${++seq}`,
      restaurant_id: input.restaurant_id,
      name: input.name,
      type: input.type,
      status: input.scheduled_at ? "scheduled" : "draft",
      channels: input.channels,
      audience: input.audience,
      template_id: input.template_id,
      scheduled_at: input.scheduled_at,
      ab_test: input.ab_test,
      metadata: input.metadata ?? {},
      created_at: now,
      updated_at: now,
    };
    store.set(c.id, c);
    MarketingAudit.record({
      restaurant_id: c.restaurant_id, action: "campaign.create",
      target_type: "campaign", target_id: c.id, metadata: { type: c.type, channels: c.channels },
    });
    await MarketingEventBus.publish({ type: "CampaignCreated", campaignId: c.id, restaurantId: c.restaurant_id, at: now });
    if (c.scheduled_at) {
      CampaignSchedulerService.schedule(c);
      await MarketingEventBus.publish({ type: "CampaignScheduled", campaignId: c.id, scheduledAt: c.scheduled_at, at: now });
    }
    return c;
  },

  get(id: string): Campaign | null { return store.get(id) ?? null; },
  list(restaurantId: string): Campaign[] {
    return [...store.values()].filter((c) => c.restaurant_id === restaurantId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async pause(id: string): Promise<Campaign> {
    const c = store.get(id); if (!c) throw new Error("Campaign not found");
    transition(c, "paused");
    await MarketingEventBus.publish({ type: "CampaignPaused", campaignId: id, at: new Date().toISOString() });
    return c;
  },

  async cancel(id: string): Promise<Campaign> {
    const c = store.get(id); if (!c) throw new Error("Campaign not found");
    transition(c, "cancelled");
    CampaignSchedulerService.cancel(id);
    return c;
  },

  async complete(id: string): Promise<Campaign> {
    const c = store.get(id); if (!c) throw new Error("Campaign not found");
    transition(c, "completed");
    await MarketingEventBus.publish({ type: "CampaignCompleted", campaignId: id, at: new Date().toISOString() });
    return c;
  },

  /**
   * Launch a campaign: resolve audience from provided candidates (from CustomerIntelligence),
   * optionally distribute A/B variants, then transition to running.
   */
  async launch(id: string, candidates: AudienceCandidate[]): Promise<CampaignDispatchResult> {
    const c = store.get(id); if (!c) throw new Error("Campaign not found");
    if (c.status !== "draft" && c.status !== "scheduled" && c.status !== "paused") {
      throw new Error(`Cannot launch from status ${c.status}`);
    }
    const resolution = AudienceBuilder.resolve(c, candidates);
    transition(c, "running");
    let variantCounts: Record<string, number> | undefined;
    if (c.ab_test) {
      const groups = ABTestingEngine.distribute(c.ab_test, resolution.customer_ids);
      variantCounts = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]));
    }
    MarketingAudit.record({
      restaurant_id: c.restaurant_id, action: "campaign.launch",
      target_type: "campaign", target_id: id,
      metadata: { audience: resolution.size, filtered: resolution.filtered_out },
    });
    await MarketingEventBus.publish({
      type: "CampaignLaunched", campaignId: id, audienceSize: resolution.size, at: new Date().toISOString(),
    });
    return {
      campaign_id: id,
      audience_size: resolution.size,
      scheduled: resolution.size,
      channels: c.channels,
      variants: variantCounts,
    };
  },

  clear(): void { store.clear(); seq = 0; },
} as const;

import type { Campaign } from "./types";

export interface ScheduledCampaignJob {
  campaign_id: string;
  restaurant_id: string;
  run_at: string;
}

const queue: ScheduledCampaignJob[] = [];

export const CampaignSchedulerService = {
  schedule(c: Pick<Campaign, "id" | "restaurant_id" | "scheduled_at">): ScheduledCampaignJob {
    if (!c.scheduled_at) throw new Error("scheduled_at required");
    const job: ScheduledCampaignJob = {
      campaign_id: c.id, restaurant_id: c.restaurant_id, run_at: c.scheduled_at,
    };
    queue.push(job);
    return job;
  },
  cancel(campaignId: string): number {
    let n = 0;
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].campaign_id === campaignId) { queue.splice(i, 1); n++; }
    }
    return n;
  },
  due(atIso: string): ScheduledCampaignJob[] {
    const at = new Date(atIso).getTime();
    return queue.filter((j) => new Date(j.run_at).getTime() <= at);
  },
  list(restaurantId?: string): ScheduledCampaignJob[] {
    return restaurantId ? queue.filter((j) => j.restaurant_id === restaurantId) : [...queue];
  },
  clear(): void { queue.length = 0; },
} as const;

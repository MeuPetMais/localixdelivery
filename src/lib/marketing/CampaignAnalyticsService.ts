import type { CampaignMetrics } from "./types";

export interface CampaignMetricInput {
  campaign_id: string;
  audience_size: number;
  delivered?: number;
  opened?: number;
  clicked?: number;
  converted?: number;
  revenue?: number;
  coupon_uses?: number;
  cost?: number;
}

const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 10000) / 100 : 0);

export const CampaignAnalyticsService = {
  compute(input: CampaignMetricInput): CampaignMetrics {
    const delivered = input.delivered ?? 0;
    const opened = input.opened ?? 0;
    const clicked = input.clicked ?? 0;
    const converted = input.converted ?? 0;
    const revenue = input.revenue ?? 0;
    const cost = input.cost ?? 0;
    return {
      campaign_id: input.campaign_id,
      audience_size: input.audience_size,
      delivered,
      opened,
      clicked,
      converted,
      revenue,
      coupon_uses: input.coupon_uses ?? 0,
      roi: cost > 0 ? Math.round(((revenue - cost) / cost) * 10000) / 100 : 0,
      open_rate: rate(opened, delivered),
      click_rate: rate(clicked, delivered),
      conversion_rate: rate(converted, delivered),
    };
  },

  aggregate(list: CampaignMetrics[]): Omit<CampaignMetrics, "campaign_id"> & { campaigns: number } {
    const sum = (k: keyof CampaignMetrics) =>
      list.reduce((s, m) => s + (Number(m[k]) || 0), 0);
    const delivered = sum("delivered");
    return {
      campaigns: list.length,
      audience_size: sum("audience_size"),
      delivered,
      opened: sum("opened"),
      clicked: sum("clicked"),
      converted: sum("converted"),
      revenue: sum("revenue"),
      coupon_uses: sum("coupon_uses"),
      roi: list.length ? Math.round((list.reduce((s, m) => s + m.roi, 0) / list.length) * 100) / 100 : 0,
      open_rate: rate(sum("opened"), delivered),
      click_rate: rate(sum("clicked"), delivered),
      conversion_rate: rate(sum("converted"), delivered),
    };
  },
} as const;

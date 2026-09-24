import { describe, expect, it } from "vitest";
import { planGrowthCampaignAutomation } from "./customer360-campaign-automation";
import type { Customer360ReadModel } from "./customer360";

function model(lifecycle: Customer360ReadModel["lifecycle"]): Customer360ReadModel {
  return {
    customer: {
      id: "c",
      restaurant_id: "r",
      name: "Cliente",
      phone: "11999999999",
      email: null,
      total_orders: 2,
      total_spent: 100,
      avg_ticket: 50,
      last_order_at: "2026-09-20T12:00:00.000Z",
      created_at: "2026-08-01T12:00:00.000Z",
      updated_at: "2026-09-20T12:00:00.000Z",
    },
    lifecycle,
    metric_time_basis: "UTC",
    metrics: {
      total_orders: 2,
      total_spent: 100,
      avg_ticket: 50,
      first_order_at: "2026-08-01T12:00:00.000Z",
      last_order_at: "2026-09-20T12:00:00.000Z",
      days_since_last_order: 4,
      avg_days_between_orders: 20,
      frequency_per_30d: 1.5,
      favorite_products: [],
      predominant_weekday_utc: 5,
      predominant_hour_utc: 22,
      coupon_usage_count: 0,
      cancellations: 0,
      refunds: 0,
      chargebacks: 0,
    },
  };
}

const consent = {
  id: "consent-1",
  channel: "WHATSAPP" as const,
  granted: true,
  captured_at: "2026-09-20T10:00:00.000Z",
  revoked_at: null,
};

describe("GROWTH-8 campaign automation planner", () => {
  it("blocks without explicit consent", () => {
    const plan = planGrowthCampaignAutomation({
      customer360: model("AT_RISK"),
      insights: [],
      channel: "WHATSAPP",
      latestConsent: null,
      providerAvailable: true,
      recentJobs: [],
      now: new Date("2026-09-24T12:00:00.000Z"),
    });
    expect(plan?.status).toBe("BLOCKED_CONSENT");
  });

  it("blocks when provider is unavailable", () => {
    const plan = planGrowthCampaignAutomation({
      customer360: model("AT_RISK"),
      insights: [],
      channel: "WHATSAPP",
      latestConsent: consent,
      providerAvailable: false,
      recentJobs: [],
      now: new Date("2026-09-24T12:00:00.000Z"),
    });
    expect(plan?.status).toBe("BLOCKED_PROVIDER");
  });

  it("blocks equivalent jobs inside cooldown", () => {
    const plan = planGrowthCampaignAutomation({
      customer360: model("AT_RISK"),
      insights: [],
      channel: "WHATSAPP",
      latestConsent: consent,
      providerAvailable: true,
      recentJobs: [{
        trigger_type: "AT_RISK",
        channel: "WHATSAPP",
        created_at: "2026-09-22T12:00:00.000Z",
        status: "READY",
      }],
      now: new Date("2026-09-24T12:00:00.000Z"),
      cooldownDays: 7,
    });
    expect(plan?.status).toBe("BLOCKED_FREQUENCY");
  });

  it("becomes READY only with consent, provider and no recent duplicate", () => {
    const plan = planGrowthCampaignAutomation({
      customer360: model("AT_RISK"),
      insights: [],
      channel: "WHATSAPP",
      latestConsent: consent,
      providerAvailable: true,
      recentJobs: [],
      now: new Date("2026-09-24T12:00:00.000Z"),
    });
    expect(plan?.status).toBe("READY");
    expect(plan?.action_key).toBe("REACTIVATE_CUSTOMER");
  });

  it("does not automate unsupported lifecycle states", () => {
    const plan = planGrowthCampaignAutomation({
      customer360: model("HIGH_VALUE"),
      insights: [],
      channel: "WHATSAPP",
      latestConsent: consent,
      providerAvailable: true,
      recentJobs: [],
    });
    expect(plan).toBeNull();
  });
});

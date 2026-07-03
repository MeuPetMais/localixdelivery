import type { PlanDefinition, PlanTier } from "./types";

// Catálogo determinístico de planos. Preços/limites podem ser sobrepostos via platform_settings.
export const PLAN_CATALOG: Record<PlanTier, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    monthly_price: 0,
    yearly_price: 0,
    commission_rate: 0.05,
    fixed_fee: 0.99,
    limits: {
      max_orders_per_month: 100,
      max_products: 30,
      max_employees: 2,
      max_locations: 1,
    },
    features: ["orders.basic", "menu.basic", "notifications.email"],
    restrictions: ["no_loyalty", "no_ai", "no_priority_support"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    monthly_price: 79,
    yearly_price: 790,
    commission_rate: 0.04,
    fixed_fee: 0.79,
    limits: {
      max_orders_per_month: 1000,
      max_products: 150,
      max_employees: 5,
      max_locations: 1,
    },
    features: ["orders.basic", "menu.basic", "notifications.email", "notifications.push", "loyalty.basic"],
    restrictions: ["no_ai", "no_multi_location"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthly_price: 199,
    yearly_price: 1990,
    commission_rate: 0.03,
    fixed_fee: 0.59,
    limits: {
      max_orders_per_month: 10000,
      max_products: 1000,
      max_employees: 20,
      max_locations: 3,
    },
    features: [
      "orders.advanced",
      "menu.advanced",
      "notifications.all",
      "loyalty.full",
      "ai.basic",
      "analytics.advanced",
    ],
    restrictions: [],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    monthly_price: 999,
    yearly_price: 9990,
    commission_rate: 0.02,
    fixed_fee: 0.39,
    limits: {
      max_orders_per_month: null,
      max_products: null,
      max_employees: null,
      max_locations: null,
    },
    features: [
      "orders.advanced",
      "menu.advanced",
      "notifications.all",
      "loyalty.full",
      "ai.full",
      "analytics.advanced",
      "sso",
      "priority_support",
      "multi_location",
      "custom_integrations",
    ],
    restrictions: [],
  },
};

export const PlanCatalogService = {
  list(): PlanDefinition[] {
    return Object.values(PLAN_CATALOG);
  },
  get(tier: PlanTier): PlanDefinition {
    const plan = PLAN_CATALOG[tier];
    if (!plan) throw new Error(`Unknown plan: ${tier}`);
    return plan;
  },
  isUpgrade(from: PlanTier, to: PlanTier): boolean {
    const order: PlanTier[] = ["free", "starter", "pro", "enterprise"];
    return order.indexOf(to) > order.indexOf(from);
  },
  isWithinLimit(tier: PlanTier, key: keyof PlanDefinition["limits"], value: number): boolean {
    const limit = PLAN_CATALOG[tier].limits[key];
    if (limit === null) return true;
    return value <= limit;
  },
};

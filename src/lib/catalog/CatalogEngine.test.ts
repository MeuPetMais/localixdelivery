import { describe, expect, it, beforeEach } from "vitest";
import { CatalogAvailabilityService } from "./CatalogAvailabilityService";
import { CatalogValidator } from "./CatalogValidator";
import { OrderingService } from "./OrderingService";
import { ProductVisibilityService } from "./ProductVisibilityService";
import { CatalogSearchService } from "./CatalogSearchService";
import { CatalogEventBus, type CatalogDomainEvent } from "./CatalogEventBus";
import type { CatalogMenu } from "./types";

const baseMenu = (overrides: Partial<CatalogMenu> = {}): CatalogMenu => ({
  id: "m1", restaurant_id: "r1", name: "Delivery", description: null,
  channel: "delivery", status: "published", display_order: 0, is_default: true,
  available_days: null, available_start_time: null, available_end_time: null,
  created_at: "", updated_at: "", ...overrides,
});

describe("CatalogValidator", () => {
  it("rejects empty name", () => {
    expect(CatalogValidator.validateMenu({ name: "" }).ok).toBe(false);
  });
  it("accepts valid menu", () => {
    expect(CatalogValidator.validateMenu({ name: "Delivery", channel: "delivery" }).ok).toBe(true);
  });
  it("guards transitions", () => {
    expect(CatalogValidator.canTransition("draft", "published")).toBe(true);
    expect(CatalogValidator.canTransition("archived", "published")).toBe(false);
  });
  it("rejects invalid day range", () => {
    expect(CatalogValidator.validateMenu({ name: "X", available_days: [8] }).ok).toBe(false);
  });
});

describe("CatalogAvailabilityService", () => {
  it("blocks archived menu", () => {
    const r = CatalogAvailabilityService.resolve(baseMenu({ status: "archived" }));
    expect(r.available).toBe(false);
  });
  it("blocks wrong channel", () => {
    const r = CatalogAvailabilityService.resolve(baseMenu(), { channel: "pickup" });
    expect(r.available).toBe(false);
  });
  it("blocks outside time window", () => {
    const now = new Date("2026-01-05T22:00:00");
    const r = CatalogAvailabilityService.resolve(
      baseMenu({ available_start_time: "08:00", available_end_time: "18:00" }),
      { now },
    );
    expect(r.available).toBe(false);
  });
  it("allows published in channel", () => {
    expect(CatalogAvailabilityService.resolve(baseMenu(), { channel: "delivery" }).available).toBe(true);
  });
});

describe("OrderingService", () => {
  const items = [
    { productId: "a", displayOrder: 2, salesCount: 5, profitAmount: 10, createdAt: "2026-01-01" },
    { productId: "b", displayOrder: 1, salesCount: 20, profitAmount: 5, createdAt: "2026-02-01" },
    { productId: "c", displayOrder: 3, salesCount: 1, profitAmount: 100, createdAt: "2026-03-01" },
  ];
  it("sorts manual", () => expect(OrderingService.apply(items, "manual")[0].productId).toBe("b"));
  it("sorts best_sellers", () => expect(OrderingService.apply(items, "best_sellers")[0].productId).toBe("b"));
  it("sorts most_profitable", () => expect(OrderingService.apply(items, "most_profitable")[0].productId).toBe("c"));
  it("sorts recent", () => expect(OrderingService.apply(items, "recent")[0].productId).toBe("c"));
});

describe("ProductVisibilityService", () => {
  it("hides when is_available false", () => {
    expect(ProductVisibilityService.isVisible({ is_available: false }, "delivery")).toBe(false);
  });
  it("hides on delivery when disabled", () => {
    expect(ProductVisibilityService.isVisible({ available_delivery: false }, "delivery")).toBe(false);
  });
  it("requires explicit flag for marketplace", () => {
    expect(ProductVisibilityService.isVisible({}, "marketplace")).toBe(false);
    expect(ProductVisibilityService.isVisible({ available_marketplace: true }, "marketplace")).toBe(true);
  });
});

describe("CatalogSearchService", () => {
  const svc = new CatalogSearchService([
    { productId: "1", name: "Pizza Margherita", categoryId: "c1", categoryName: "Pizzas", tags: ["classica"], ingredients: ["queijo"] },
    { productId: "2", name: "Burger Bacon", categoryId: "c2", categoryName: "Burgers", tags: ["novo"], ingredients: ["bacon"] },
  ]);
  it("filters by text (case/accents)", () => expect(svc.query({ text: "MARGHERITA" }).length).toBe(1));
  it("filters by category", () => expect(svc.query({ categoryId: "c2" })[0].productId).toBe("2"));
  it("filters by tag", () => expect(svc.query({ tag: "novo" }).length).toBe(1));
  it("filters by ingredient", () => expect(svc.query({ ingredient: "queijo" }).length).toBe(1));
});

describe("CatalogEventBus", () => {
  beforeEach(() => CatalogEventBus.clear());
  it("publishes to subscribers", async () => {
    const seen: CatalogDomainEvent[] = [];
    CatalogEventBus.subscribe((e) => { seen.push(e); });
    await CatalogEventBus.publish({ type: "MenuCreated", menuId: "m1", restaurantId: "r1", at: "now" });
    expect(seen).toHaveLength(1);
  });
});

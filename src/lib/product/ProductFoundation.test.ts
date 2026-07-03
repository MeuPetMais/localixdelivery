import { describe, it, expect, beforeEach } from "vitest";
import { ProductLifecycle } from "./ProductLifecycle";
import { ProductValidator } from "./ProductValidator";
import { ProductAvailabilityService } from "./ProductAvailabilityService";
import { ProductSearchService } from "./ProductSearchService";
import { ProductEventBus } from "./ProductEventBus";
import type { ProductRecord } from "./types";

const baseProduct = (over: Partial<ProductRecord> = {}): ProductRecord => ({
  id: "p1",
  restaurant_id: "r1",
  category_id: "c1",
  name: "Pizza",
  description: "desc",
  price: 30,
  promo_price: null,
  promo_starts_at: null,
  promo_ends_at: null,
  image_url: "https://x/y.jpg",
  position: 1,
  is_available: true,
  is_active: true,
  is_paused: false,
  is_featured: false,
  is_bestseller: false,
  available_delivery: true,
  available_pickup: true,
  recurrence_days: null,
  recurrence_start_time: null,
  recurrence_end_time: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...over,
});

describe("ProductLifecycle", () => {
  it("derives PUBLISHED / PAUSED / ARCHIVED / SCHEDULED", () => {
    expect(ProductLifecycle.fromRecord(baseProduct())).toBe("PUBLISHED");
    expect(ProductLifecycle.fromRecord(baseProduct({ is_paused: true }))).toBe("PAUSED");
    expect(ProductLifecycle.fromRecord(baseProduct({ is_active: false }))).toBe("ARCHIVED");
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(ProductLifecycle.fromRecord(baseProduct({ promo_starts_at: future }))).toBe("SCHEDULED");
  });

  it("enforces transitions", () => {
    expect(ProductLifecycle.canTransition("DRAFT", "PUBLISHED")).toBe(true);
    expect(ProductLifecycle.canTransition("DISCONTINUED", "PUBLISHED")).toBe(false);
    expect(() => ProductLifecycle.assertTransition("DISCONTINUED", "PUBLISHED")).toThrow();
  });
});

describe("ProductValidator", () => {
  it("requires name and price", () => {
    expect(ProductValidator.validate({}).ok).toBe(false);
    expect(ProductValidator.validate({ name: "X", price: 1 }).ok).toBe(true);
  });
  it("rejects promo >= price", () => {
    const r = ProductValidator.validate({ name: "X", price: 10, promo_price: 12 });
    expect(r.ok).toBe(false);
  });
  it("requires image + description when publishable", () => {
    const r = ProductValidator.validate({ name: "X", price: 10 }, { requirePublishable: true });
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.field)).toEqual(expect.arrayContaining(["category_id", "image_url", "description"]));
  });
});

describe("ProductAvailabilityService", () => {
  it("returns available for a healthy product", () => {
    expect(ProductAvailabilityService.resolve(baseProduct()).available).toBe(true);
  });
  it("blocks by channel", () => {
    const r = ProductAvailabilityService.resolve(baseProduct({ available_delivery: false }), { channel: "delivery" });
    expect(r.available).toBe(false);
    expect(r.reasons).toContain("channel:delivery_disabled");
  });
  it("blocks by stock signal", () => {
    const r = ProductAvailabilityService.resolve(baseProduct(), { stockAvailable: false });
    expect(r.available).toBe(false);
  });
  it("respects weekday recurrence", () => {
    const now = new Date("2026-01-05T12:00:00Z"); // Monday
    const r = ProductAvailabilityService.resolve(baseProduct({ recurrence_days: [0] }), { now });
    expect(r.reasons).toContain("schedule:weekday");
  });
});

describe("ProductSearchService", () => {
  it("indexes and finds by name/tag/category", () => {
    const docs = ProductSearchService.index(
      [baseProduct({ id: "a", name: "Pizza Calabresa" }), baseProduct({ id: "b", name: "Burger", category_id: "c2" })],
      { a: ["promo", "italiana"] },
    );
    expect(ProductSearchService.search(docs, { q: "calabresa" }).map((d) => d.id)).toEqual(["a"]);
    expect(ProductSearchService.search(docs, { tag: "italiana" }).map((d) => d.id)).toEqual(["a"]);
    expect(ProductSearchService.search(docs, { categoryId: "c2" }).map((d) => d.id)).toEqual(["b"]);
  });
});

describe("ProductEventBus", () => {
  beforeEach(() => ProductEventBus.clear());
  it("delivers events to subscribers", async () => {
    const seen: string[] = [];
    ProductEventBus.subscribe((e) => { seen.push(e.type); });
    await ProductEventBus.publish({ type: "ProductCreated", productId: "p", restaurantId: "r", at: "now" });
    expect(seen).toEqual(["ProductCreated"]);
  });
});

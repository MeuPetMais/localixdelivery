import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFeaturedItemPrice, type FeaturedItem } from "./featured-sections.functions";

function item(overrides: Partial<FeaturedItem> = {}): FeaturedItem {
  return {
    id: "item-1",
    name: "Bacon Supreme",
    description: null,
    price: 35,
    promo_price: null,
    promo_starts_at: null,
    promo_ends_at: null,
    recurrence_days: null,
    recurrence_start_time: null,
    recurrence_end_time: null,
    image_url: null,
    is_available: true,
    is_paused: false,
    ...overrides,
  };
}

describe("getFeaturedItemPrice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses price when there is no promo_price", () => {
    expect(getFeaturedItemPrice(item())).toBe(35);
  });

  it("uses promo_price when promotion is active", () => {
    vi.setSystemTime(new Date("2026-08-14T15:00:00.000Z"));

    expect(
      getFeaturedItemPrice(
        item({
          promo_price: 27.96,
          promo_starts_at: "2026-08-14T12:00:00.000Z",
          promo_ends_at: "2026-08-14T18:00:00.000Z",
        }),
      ),
    ).toBe(27.96);
  });

  it("uses price when promotion is expired", () => {
    vi.setSystemTime(new Date("2026-08-14T15:00:00.000Z"));

    expect(
      getFeaturedItemPrice(
        item({
          promo_price: 27.96,
          promo_ends_at: "2026-08-14T14:59:00.000Z",
        }),
      ),
    ).toBe(35);
  });

  it("uses price when promotion is scheduled for the future", () => {
    vi.setSystemTime(new Date("2026-08-14T15:00:00.000Z"));

    expect(
      getFeaturedItemPrice(
        item({
          promo_price: 27.96,
          promo_starts_at: "2026-08-14T15:01:00.000Z",
        }),
      ),
    ).toBe(35);
  });

  it("uses price when recurring promotion is outside the time window", () => {
    vi.setSystemTime(new Date("2026-08-14T15:00:00.000Z"));

    expect(
      getFeaturedItemPrice(
        item({
          promo_price: 27.96,
          recurrence_days: [5],
          recurrence_start_time: "16:00",
          recurrence_end_time: "17:00",
        }),
      ),
    ).toBe(35);
  });
});

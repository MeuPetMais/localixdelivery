import { describe, expect, it } from "vitest";
import { calculateBuilderCatalogUnitPrice } from "./builder-catalog-pricing";

const restaurantId = "rest-1";

function menuItem(id: string, price: number) {
  return {
    id,
    restaurant_id: restaurantId,
    price,
    promo_price: null,
    is_active: true,
    is_available: true,
    is_paused: false,
  };
}

const flavorGroup = {
  id: "flavors",
  source_type: "MENU_ITEMS" as const,
  price_strategy: "MAX_MENU_ITEM" as const,
  builder_options: [
    { id: "calabresa", group_id: "flavors", price_delta: 0, max_qty: 1, menu_item_id: "p1", menu_item: menuItem("p1", 49.9) },
    { id: "caipira", group_id: "flavors", price_delta: 0, max_qty: 1, menu_item_id: "p2", menu_item: menuItem("p2", 58.9) },
    { id: "carne-seca", group_id: "flavors", price_delta: 0, max_qty: 1, menu_item_id: "p3", menu_item: menuItem("p3", 60.9) },
  ],
};

const extrasGroup = {
  id: "extras",
  source_type: "MANUAL" as const,
  price_strategy: "SUM" as const,
  builder_options: [
    { id: "borda", group_id: "extras", price_delta: 6, max_qty: 1 },
    { id: "bacon", group_id: "extras", price_delta: 4, max_qty: 1 },
  ],
};

describe("calculateBuilderCatalogUnitPrice", () => {
  it("uses the selected flavor price when one flavor is chosen", () => {
    expect(calculateBuilderCatalogUnitPrice({
      restaurantId,
      basePrice: 49.9,
      groups: [flavorGroup],
      selections: [{ group_id: "flavors", option_id: "caipira", quantity: 1 }],
    })).toBe(58.9);
  });

  it("uses only the highest price with two or three flavors", () => {
    expect(calculateBuilderCatalogUnitPrice({
      restaurantId,
      basePrice: 49.9,
      groups: [flavorGroup],
      selections: [
        { group_id: "flavors", option_id: "calabresa", quantity: 1 },
        { group_id: "flavors", option_id: "caipira", quantity: 1 },
        { group_id: "flavors", option_id: "carne-seca", quantity: 1 },
      ],
    })).toBe(60.9);
  });

  it("adds normal extras after resolving the highest flavor price", () => {
    expect(calculateBuilderCatalogUnitPrice({
      restaurantId,
      basePrice: 49.9,
      groups: [flavorGroup, extrasGroup],
      selections: [
        { group_id: "flavors", option_id: "carne-seca", quantity: 1 },
        { group_id: "extras", option_id: "borda", quantity: 1 },
        { group_id: "extras", option_id: "bacon", quantity: 1 },
      ],
    })).toBe(70.9);
  });

  it("is independent of group display order", () => {
    expect(calculateBuilderCatalogUnitPrice({
      restaurantId,
      basePrice: 49.9,
      groups: [extrasGroup, flavorGroup],
      selections: [
        { group_id: "extras", option_id: "borda", quantity: 1 },
        { group_id: "flavors", option_id: "carne-seca", quantity: 1 },
      ],
    })).toBe(66.9);
  });

  it("rejects linked catalog items from another restaurant", () => {
    const invalidGroup = {
      ...flavorGroup,
      builder_options: [{
        id: "x",
        group_id: "flavors",
        price_delta: 0,
        max_qty: 1,
        menu_item_id: "other",
        menu_item: { ...menuItem("other", 99), restaurant_id: "rest-2" },
      }],
    };

    expect(() => calculateBuilderCatalogUnitPrice({
      restaurantId,
      basePrice: 49.9,
      groups: [invalidGroup],
      selections: [{ group_id: "flavors", option_id: "x", quantity: 1 }],
    })).toThrow("builder_catalog_item_wrong_restaurant");
  });
});

import { describe, expect, it } from "vitest";
import type { CartItem } from "./cart-lines";
import {
  addOptionToCartLine,
  decrementOptionQuantity,
  incrementOptionQuantity,
  removeOptionFromCartLine,
  updateCartLineOption,
} from "./cart-line-options";
import type { ProductOption, ProductOptionGroup } from "@/lib/product/configuration/types";

const baseLine = (overrides: Partial<CartItem> = {}): CartItem => ({
  lineId: "line:a",
  id: "burger",
  name: "Burger",
  price: 25,
  qty: 1,
  ...overrides,
});

const group = (overrides: Partial<ProductOptionGroup> = {}): ProductOptionGroup => ({
  id: "extras",
  product_id: "burger",
  name: "Adicionais",
  type: "MULTIPLE",
  min_selection: 0,
  max_selection: 4,
  required: false,
  price_strategy: "SUM",
  display_order: 0,
  ...overrides,
});

const option = (overrides: Partial<ProductOption> = {}): ProductOption => ({
  id: "bacon",
  group_id: "extras",
  name: "Bacon extra",
  price_adjustment: 4,
  max_quantity: 1,
  display_order: 0,
  active: true,
  metadata: { upsell_enabled: true },
  ...overrides,
});

const config = (
  overrides: {
    line?: CartItem;
    group?: ProductOptionGroup;
    option?: ProductOption;
    groups?: ProductOptionGroup[];
    options?: ProductOption[];
    basePrice?: number;
  } = {},
) => {
  const line = overrides.line ?? baseLine();
  const g = overrides.group ?? group();
  const o = overrides.option ?? option();
  return {
    line,
    group: g,
    option: o,
    groups: overrides.groups ?? [g],
    options: overrides.options ?? [o],
    basePrice: overrides.basePrice ?? 25,
  };
};

describe("cart line option mutations", () => {
  it("adds a max_quantity=1 option", () => {
    const result = addOptionToCartLine(config());

    expect(result.changed).toBe(true);
    expect(result.line.selections).toEqual([
      { group_id: "extras", option_id: "bacon", quantity: 1 },
    ]);
    expect(result.line.price).toBe(29);
  });

  it("removes an option", () => {
    const line = baseLine({
      price: 29,
      selections: [{ group_id: "extras", option_id: "bacon", quantity: 1 }],
    });

    const result = removeOptionFromCartLine(config({ line }));

    expect(result.changed).toBe(true);
    expect(result.line.selections).toEqual([]);
    expect(result.line.price).toBe(25);
  });

  it("increments a quantity option from 0 to 1 to 2", () => {
    const o = option({ max_quantity: 3 });
    const first = incrementOptionQuantity(config({ option: o, options: [o] }));
    const second = incrementOptionQuantity(config({ line: first.line, option: o, options: [o] }));

    expect(second.line.selections).toEqual([
      { group_id: "extras", option_id: "bacon", quantity: 2 },
    ]);
    expect(second.line.price).toBe(33);
  });

  it("does not exceed option.max_quantity", () => {
    const o = option({ max_quantity: 2 });
    const line = baseLine({
      price: 33,
      selections: [{ group_id: "extras", option_id: "bacon", quantity: 2 }],
    });

    const result = incrementOptionQuantity(config({ line, option: o, options: [o] }));

    expect(result.changed).toBe(false);
    expect(result.line).toBe(line);
  });

  it("does not exceed group.max_selection", () => {
    const g = group({ max_selection: 1 });
    const line = baseLine({
      selections: [{ group_id: "extras", option_id: "cheese", quantity: 1 }],
    });

    const result = addOptionToCartLine(
      config({
        line,
        group: g,
        groups: [g],
        options: [option({ id: "cheese" }), option({ id: "bacon" })],
      }),
    );

    expect(result.changed).toBe(false);
  });

  it("does not add an option with an invalid dependency", () => {
    const g = group({ depends_on_option_id: "combo" });

    const result = addOptionToCartLine(config({ group: g, groups: [g] }));

    expect(result.changed).toBe(false);
  });

  it("does not apply an inactive option", () => {
    const o = option({ active: false });

    const result = addOptionToCartLine(config({ option: o, options: [o] }));

    expect(result.changed).toBe(false);
  });

  it("does not apply an option that is not enabled for Turbine", () => {
    const o = option({ metadata: {} });

    const result = addOptionToCartLine(config({ option: o, options: [o] }));

    expect(result.changed).toBe(false);
  });

  it("updates only the requested lineId", () => {
    const cart = [baseLine({ lineId: "line:a" }), baseLine({ lineId: "line:b" })];

    const result = updateCartLineOption(cart, "line:b", (line) =>
      addOptionToCartLine(config({ line })),
    );

    expect(result.cart[0]).toBe(cart[0]);
    expect(result.cart[1].selections).toEqual([
      { group_id: "extras", option_id: "bacon", quantity: 1 },
    ]);
  });

  it("keeps BASE 5b repeated product lines independent and applies Turbine only to the second lineId", () => {
    const cart = [baseLine({ lineId: "line:a" }), baseLine({ lineId: "line:b" })];

    const result = updateCartLineOption(cart, "line:b", (line) =>
      addOptionToCartLine(config({ line })),
    );

    expect(result.cart[0].selections).toBeUndefined();
    expect(result.cart[1].id).toBe("burger");
    expect(result.cart[1].lineId).toBe("line:b");
  });

  it("decreases visual price when quantity is decremented", () => {
    const o = option({ max_quantity: 3 });
    const line = baseLine({
      price: 33,
      selections: [{ group_id: "extras", option_id: "bacon", quantity: 2 }],
    });

    const result = decrementOptionQuantity(config({ line, option: o, options: [o] }));

    expect(result.line.selections).toEqual([
      { group_id: "extras", option_id: "bacon", quantity: 1 },
    ]);
    expect(result.line.price).toBe(29);
  });

  it("keeps cart subtotal in sync with preview line price", () => {
    const cart = [
      baseLine({ lineId: "line:a", qty: 2 }),
      baseLine({ lineId: "line:b", price: 10 }),
    ];
    const result = updateCartLineOption(cart, "line:a", (line) =>
      addOptionToCartLine(config({ line })),
    );

    expect(result.cart.reduce((sum, item) => sum + item.price * item.qty, 0)).toBe(68);
  });

  it("keeps selections serializable for sessionStorage and restore", () => {
    const line = addOptionToCartLine(config()).line;

    const restored = JSON.parse(JSON.stringify(line)) as CartItem;

    expect(restored.selections).toEqual([{ group_id: "extras", option_id: "bacon", quantity: 1 }]);
  });

  it("keeps checkout payload with product id and without lineId identity", () => {
    const line = addOptionToCartLine(
      config({ line: baseLine({ lineId: "line:not-product" }) }),
    ).line;
    const payload = {
      id: line.id,
      qty: line.qty,
      kind: line.kind,
      builderId: line.builderId,
      selections: line.selections,
      notes: line.notes,
    };

    expect(payload.id).toBe("burger");
    expect(JSON.stringify(payload)).not.toContain("line:not-product");
  });

  it("does not mutate builder lines", () => {
    const line = baseLine({ kind: "builder", builderId: "builder-1" });

    const result = addOptionToCartLine(config({ line }));

    expect(result.changed).toBe(false);
    expect(result.line).toBe(line);
  });
});

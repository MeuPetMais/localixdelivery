import { describe, expect, it } from "vitest";
import type { CartItem } from "./cart-lines";
import { getTurbineCandidates, getTurbineDisplayCandidates } from "./turbine-candidates";
import type { ProductOption, ProductOptionGroup } from "@/lib/product/configuration/types";

const line = (overrides: Partial<CartItem> = {}): CartItem => ({
  lineId: "line:burger-1",
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
  name: "Bacon",
  price_adjustment: 5,
  max_quantity: 1,
  display_order: 0,
  active: true,
  metadata: { upsell_enabled: true },
  ...overrides,
});

describe("getTurbineCandidates", () => {
  it("shows an active option", () => {
    expect(
      getTurbineCandidates({ line: line(), groups: [group({})], options: [option({})] }),
    ).toHaveLength(1);
  });

  it("hides options when upsell_enabled is false", () => {
    expect(
      getTurbineCandidates({
        line: line(),
        groups: [group({})],
        options: [option({ metadata: { upsell_enabled: false } })],
      }),
    ).toHaveLength(0);
  });

  it("hides options when upsell_enabled is missing", () => {
    expect(
      getTurbineCandidates({
        line: line(),
        groups: [group({})],
        options: [option({ metadata: {} })],
      }),
    ).toHaveLength(0);
  });

  it("hides inactive options", () => {
    expect(
      getTurbineCandidates({
        line: line(),
        groups: [group({})],
        options: [option({ active: false })],
      }),
    ).toHaveLength(0);
  });

  it("hides options from another product", () => {
    expect(
      getTurbineCandidates({
        line: line(),
        groups: [group({ product_id: "pizza" })],
        options: [option({})],
      }),
    ).toHaveLength(0);
  });

  it("limits candidates to four options", () => {
    const options = Array.from({ length: 6 }, (_, index) =>
      option({ id: `opt-${index}`, name: `Opção ${index}`, display_order: index }),
    );

    expect(getTurbineCandidates({ line: line(), groups: [group({})], options })).toHaveLength(4);
  });

  it("sorts by display_order before stable fallback", () => {
    const result = getTurbineCandidates({
      line: line(),
      groups: [group({})],
      options: [
        option({ id: "z", name: "Z", display_order: 2 }),
        option({ id: "a", name: "A", display_order: 1 }),
      ],
    });

    expect(result.map((candidate) => candidate.id)).toEqual(["a", "z"]);
  });

  it("sorts by upsell priority before group and option display order", () => {
    const groupA = group({ id: "extras-a", display_order: 0 });
    const groupB = group({ id: "extras-b", display_order: 1 });
    const result = getTurbineCandidates({
      line: line(),
      groups: [groupA, groupB],
      options: [
        option({
          id: "late",
          group_id: "extras-a",
          name: "Late",
          display_order: 0,
          metadata: { upsell_enabled: true, upsell_priority: 2 },
        }),
        option({
          id: "first",
          group_id: "extras-b",
          name: "First",
          display_order: 10,
          metadata: { upsell_enabled: true, upsell_priority: 1 },
        }),
      ],
    });

    expect(result.map((candidate) => candidate.id)).toEqual(["first", "late"]);
  });

  it("uses group, option, name, and id fallback when priorities tie", () => {
    const groupA = group({ id: "extras-a", display_order: 1 });
    const groupB = group({ id: "extras-b", display_order: 0 });
    const result = getTurbineCandidates({
      line: line(),
      groups: [groupA, groupB],
      options: [
        option({ id: "z", group_id: "extras-a", name: "Z", display_order: 0 }),
        option({ id: "b", group_id: "extras-b", name: "B", display_order: 2 }),
        option({ id: "a", group_id: "extras-b", name: "A", display_order: 2 }),
      ],
    });

    expect(result.map((candidate) => candidate.id)).toEqual(["a", "b", "z"]);
  });

  it("hides options already selected at max_quantity", () => {
    const result = getTurbineCandidates({
      line: line({ selections: [{ groupId: "extras", optionId: "bacon", qty: 1 }] }),
      groups: [group({})],
      options: [option({ max_quantity: 1 })],
    });

    expect(result).toHaveLength(0);
  });

  it("does not offer an extra option when the group is at max_selection", () => {
    const result = getTurbineCandidates({
      line: line({ selections: [{ groupId: "extras", optionId: "cheese", qty: 1 }] }),
      groups: [group({ max_selection: 1 })],
      options: [option({ id: "bacon" }), option({ id: "cheese" })],
    });

    expect(result).toHaveLength(0);
  });

  it("hides options when a known dependency is not satisfied", () => {
    const result = getTurbineCandidates({
      line: line(),
      groups: [group({ depends_on_option_id: "combo" })],
      options: [option({})],
    });

    expect(result).toHaveLength(0);
  });

  it("uses the line product id instead of the lineId", () => {
    const result = getTurbineCandidates({
      line: line({ lineId: "line:not-a-product-id" }),
      groups: [group({ product_id: "burger" })],
      options: [option({})],
    });

    expect(result).toHaveLength(1);
  });

  it("uses only the selections from the added line when two equal products exist", () => {
    const result = getTurbineCandidates({
      line: line({ lineId: "line:burger-2", selections: [] }),
      groups: [group({ max_selection: 1 })],
      options: [option({ id: "bacon" })],
    });

    expect(result.map((candidate) => candidate.id)).toEqual(["bacon"]);
  });

  it("keeps selected maxed options visible for removal in the display list", () => {
    const result = getTurbineDisplayCandidates({
      line: line({ selections: [{ groupId: "extras", optionId: "bacon", qty: 1 }] }),
      groups: [group({})],
      options: [option({ max_quantity: 1 })],
    });

    expect(result).toMatchObject([
      {
        id: "bacon",
        selectedQuantity: 1,
        maxQuantity: 1,
        canIncrement: false,
      },
    ]);
  });
});

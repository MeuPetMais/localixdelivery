import { describe, it, expect } from "vitest";
import { ConfigurationRuleEngine } from "./ConfigurationRuleEngine";
import { PriceCalculationStrategy } from "./PriceCalculationStrategy";
import type { ProductOption, ProductOptionGroup } from "./types";

const g = (over: Partial<ProductOptionGroup>): ProductOptionGroup => ({
  id: "g",
  product_id: "p",
  name: "Tamanho",
  type: "SINGLE",
  min_selection: 1,
  max_selection: 1,
  required: true,
  price_strategy: "SUM",
  display_order: 0,
  ...over,
});
const o = (over: Partial<ProductOption>): ProductOption => ({
  id: "o",
  group_id: "g",
  name: "M",
  price_adjustment: 0,
  max_quantity: 1,
  display_order: 0,
  active: true,
  ...over,
});

describe("ConfigurationRuleEngine", () => {
  it("required group blocks empty selection", () => {
    const res = ConfigurationRuleEngine.validate([g({})], [o({})], []);
    expect(res.valid).toBe(false);
  });
  it("SINGLE allows one selection", () => {
    const res = ConfigurationRuleEngine.validate(
      [g({})],
      [o({})],
      [{ group_id: "g", option_id: "o", quantity: 1 }],
    );
    expect(res.valid).toBe(true);
  });
  it("MULTIPLE enforces max", () => {
    const res = ConfigurationRuleEngine.validate(
      [g({ type: "MULTIPLE", max_selection: 2, required: false, min_selection: 0 })],
      [o({}), o({ id: "o2" }), o({ id: "o3" })],
      [
        { group_id: "g", option_id: "o", quantity: 1 },
        { group_id: "g", option_id: "o2", quantity: 1 },
        { group_id: "g", option_id: "o3", quantity: 1 },
      ],
    );
    expect(res.valid).toBe(false);
  });
  it("dependency: hides group when parent not selected", () => {
    const groups = [
      g({ id: "borda", type: "BOOLEAN", required: false, min_selection: 0, max_selection: 1 }),
      g({
        id: "recheio",
        depends_on_option_id: "borda-yes",
        type: "SINGLE",
        required: false,
        min_selection: 0,
      }),
    ];
    const opts = [
      o({ id: "borda-yes", group_id: "borda" }),
      o({ id: "cat", group_id: "recheio" }),
    ];
    const res = ConfigurationRuleEngine.validate(groups, opts, []);
    expect(res.valid).toBe(true);
  });
});

describe("PriceCalculationStrategy", () => {
  const groups = [g({ id: "size", price_strategy: "MAX" }), g({ id: "add", type: "MULTIPLE", price_strategy: "SUM", required: false, min_selection: 0, max_selection: 5 })];
  const opts = [
    o({ id: "p", group_id: "size", price_adjustment: 30 }),
    o({ id: "g", group_id: "size", price_adjustment: 50 }),
    o({ id: "bacon", group_id: "add", price_adjustment: 5, max_quantity: 3 }),
  ];
  it("SUM sums adjustments", () => {
    const total = PriceCalculationStrategy.calculate(
      0,
      groups,
      opts,
      [
        { group_id: "size", option_id: "g", quantity: 1 },
        { group_id: "add", option_id: "bacon", quantity: 2 },
      ],
    );
    expect(total).toBe(60); // 50 (MAX of size) + 10 (bacon x2)
  });
  it("FIXED ignores base and deltas", () => {
    const total = PriceCalculationStrategy.calculate(
      100,
      [g({ id: "size", price_strategy: "FIXED" })],
      [o({ id: "p", group_id: "size", price_adjustment: 30 })],
      [{ group_id: "size", option_id: "p", quantity: 1 }],
      79.9,
    );
    expect(total).toBe(79.9);
  });
  it("AVERAGE of 2 pizza flavors", () => {
    const gg = [g({ id: "sabor", type: "MULTIPLE", price_strategy: "AVERAGE", min_selection: 1, max_selection: 2 })];
    const oo = [
      o({ id: "marg", group_id: "sabor", price_adjustment: 40 }),
      o({ id: "cala", group_id: "sabor", price_adjustment: 60 }),
    ];
    const total = PriceCalculationStrategy.calculate(0, gg, oo, [
      { group_id: "sabor", option_id: "marg", quantity: 1 },
      { group_id: "sabor", option_id: "cala", quantity: 1 },
    ]);
    expect(total).toBe(50);
  });
});

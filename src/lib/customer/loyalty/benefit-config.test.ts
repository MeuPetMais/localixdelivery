import { describe, expect, it } from "vitest";
import { benefitMutationPayload, persistBenefitConfig, readBenefitConfig } from "./benefit-config";

describe("benefit configuration persistence", () => {
  it("preserves disabled state, priority and legacy rule type when editing existing data", () => {
    const config = {
      ui_kind: "CASHBACK",
      trigger: { kind: "SPENT", qty: "100" },
      reward: { cashback_amount: "5" },
      percent: 5,
      max_cashback: 20,
    };
    const original = { config, rule_type: "CASHBACK_PERCENT", active: false, priority: 37 };
    const payload = benefitMutationPayload(
      "restaurant",
      " Renamed ",
      readBenefitConfig(config),
      original,
    );
    expect(payload).toMatchObject({
      name: "Renamed",
      active: false,
      priority: 37,
      rule_type: "CASHBACK_PERCENT",
      config,
    });
  });
  it("round trips numeric strings and legacy engine fields through editing and saving", () => {
    const stored = {
      ui_kind: "FREE_PRODUCT",
      trigger: { kind: "PRODUCTS", qty: "10", product_name: "Burger", category_id: "cat" },
      reward: { product_name: "Burger", max_discount: 25, discount_percent: "5" },
      max_cashback: 20,
      channels: ["delivery"],
      starts_at: null,
      ends_at: null,
    };
    const edited = readBenefitConfig(stored);
    expect(edited.trigger.qty).toBe("10");
    edited.reward.product_name = "Pizza";
    const saved = persistBenefitConfig(stored, edited);
    expect(JSON.parse(JSON.stringify(saved))).toEqual({
      ...stored,
      reward: { ...stored.reward, product_name: "Pizza" },
    });
    expect(persistBenefitConfig(saved, readBenefitConfig(saved))).toEqual(saved);
  });
  it("preserves nested extension fields when a form replaces known fields", () => {
    const stored = {
      ui_kind: "DISCOUNT",
      trigger: { kind: "POINTS", qty: 10, product_id: "p" },
      reward: { discount_percent: 5, max_discount: 20 },
      percent: 7,
    };
    const edited = readBenefitConfig(stored);
    edited.trigger = { kind: "ORDERS", qty: 2 };
    edited.reward = { discount_percent: 10 };
    expect(persistBenefitConfig(stored, edited)).toMatchObject({
      trigger: { kind: "ORDERS", qty: 2, product_id: "p" },
      reward: { discount_percent: 10, max_discount: 20 },
      percent: 7,
    });
  });
  it("blocks saving incompatible legacy engine configurations instead of overwriting them with UI defaults", () => {
    const stored = { points: 10, per_amount: 5, trigger: { qty: "invalid" } };
    expect(() => persistBenefitConfig(stored, readBenefitConfig(stored))).toThrow("preservar");
  });
});

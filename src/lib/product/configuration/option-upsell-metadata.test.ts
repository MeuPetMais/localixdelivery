import { describe, expect, it } from "vitest";
import {
  isOptionUpsellEnabled,
  mergeOptionUpsellMetadata,
  optionUpsellPriority,
} from "./option-upsell-metadata";

describe("option upsell metadata", () => {
  it("enables only options with upsell_enabled=true", () => {
    expect(isOptionUpsellEnabled({ metadata: { upsell_enabled: true } })).toBe(true);
    expect(isOptionUpsellEnabled({ metadata: { upsell_enabled: false } })).toBe(false);
    expect(isOptionUpsellEnabled({ metadata: {} })).toBe(false);
    expect(isOptionUpsellEnabled({ metadata: undefined })).toBe(false);
  });

  it("preserves existing metadata when saving upsell_enabled", () => {
    expect(mergeOptionUpsellMetadata({ foo: "bar" }, { upsell_enabled: true })).toEqual({
      foo: "bar",
      upsell_enabled: true,
    });
  });

  it("preserves existing metadata when saving upsell_priority", () => {
    expect(mergeOptionUpsellMetadata({ foo: "bar" }, { upsell_priority: 1 })).toEqual({
      foo: "bar",
      upsell_priority: 1,
    });
  });

  it("allows enabling an option without metadata", () => {
    expect(mergeOptionUpsellMetadata(undefined, { upsell_enabled: true })).toEqual({
      upsell_enabled: true,
    });
  });

  it("treats priority as optional integer >= 1", () => {
    expect(optionUpsellPriority({ metadata: { upsell_priority: 2 } })).toBe(2);
    expect(optionUpsellPriority({ metadata: { upsell_priority: 0 } })).toBeNull();
    expect(optionUpsellPriority({ metadata: { upsell_priority: 1.5 } })).toBeNull();
    expect(optionUpsellPriority({ metadata: {} })).toBeNull();
  });
});

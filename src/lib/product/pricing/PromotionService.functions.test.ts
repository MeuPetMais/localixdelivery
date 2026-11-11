import { expect, it } from "vitest";
import { promotionColumnPatch } from "./promotion-patch";
it("preserves columns, nested configuration and numeric strings", () => {
  const patch = {
    name: "Campaign",
    config: { legacy_cap: 20, channels: ["delivery"], nested: { qty: "2" } },
  };
  expect(promotionColumnPatch(patch)).toEqual(patch);
});
it.each([{ rules: [] }, { targets: [] }])(
  "rejects relation writes instead of sending nonexistent columns %j",
  (patch) => {
    expect(() => promotionColumnPatch(patch)).toThrow("dedicated operations");
  },
);
it("does not erase config when updating only the name", () => {
  expect(promotionColumnPatch({ name: "Campaign" })).toEqual({ name: "Campaign" });
});

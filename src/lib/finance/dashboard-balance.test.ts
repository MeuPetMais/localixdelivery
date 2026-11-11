import { describe, it, expect } from "vitest";
import { dashboardBalance } from "./dashboard-balance";
describe("Ledger dashboard adapter", () => {
  it.each([125.5, -24.9, 0])("preserves the authoritative net balance %s", (netBalance) => {
    expect(dashboardBalance({ netBalance, currency: "BRL" })).toEqual({
      balance: netBalance,
      currency: "BRL",
    });
  });
});

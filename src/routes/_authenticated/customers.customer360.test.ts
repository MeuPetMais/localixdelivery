import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/routes/_authenticated/customers.tsx", "utf8");

describe("GROWTH-5 Customer 360 UI contract", () => {
  it("consumes the server-side Customer 360 read model", () => {
    expect(source).toContain("listCustomer360");
    expect(source).toContain("getCustomer360");
    expect(source).toContain("useServerFn");
  });

  it("does not query the customers table directly from the browser", () => {
    expect(source).not.toContain('.from("customers")');
    expect(source).not.toContain("supabase.from");
  });

  it("does not reintroduce frontend lifecycle thresholds", () => {
    expect(source).not.toContain("segmentOf");
    expect(source).not.toContain("Date.now() -");
    expect(source).not.toContain("total_spent) > 300");
    expect(source).not.toContain("total_orders >= 3");
  });

  it("renders lifecycle values returned by the server contract", () => {
    expect(source).toContain("item.lifecycle");
    expect(source).toContain("LIFECYCLE_META");
    expect(source).toContain("detail.lifecycle");
  });
});

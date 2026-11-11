import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./LedgerService.ts", import.meta.url), "utf8");
describe("Ledger server surface hardening", () => {
  it("does not expose the unused unauthenticated admin-backed ledger writer", () => {
    expect(source).not.toMatch(/export\s+const\s+recordLedgerEntry\b/);
    expect(source).not.toContain("supabaseAdmin");
    expect(source).not.toMatch(/\.insert\(/);
  });
  it("requires authentication for every remaining server function", () => {
    const functions = source.split(/export const \w+ = createServerFn/).slice(1);
    expect(functions.length).toBeGreaterThan(0);
    for (const fn of functions)
      expect(fn.slice(0, fn.indexOf(".handler("))).toContain(".middleware([requireSupabaseAuth])");
  });
});

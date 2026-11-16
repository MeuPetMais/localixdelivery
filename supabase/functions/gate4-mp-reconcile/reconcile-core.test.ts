import { describe, expect, it } from "vitest";
import {
  GATE4_ORDER, GATE4_SELLER, completeSearch, remainingPages,
  sanitizePayments, searchUrl,
} from "./reconcile-core.ts";
import { readFileSync } from "node:fs";

const handler = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const row = (id: number) => ({
  id, status: "pending", transaction_amount: 30.99,
  external_reference: GATE4_ORDER, currency_id: "BRL",
});

describe("gate4 readonly reconciliation contract", () => {
  it("hardcodes sandbox order and seller and only uses payments SEARCH", () => {
    expect(GATE4_SELLER).toBe("3845624814");
    const url = new URL(searchUrl(0));
    expect(url.origin).toBe("https://api.mercadopago.com");
    expect(url.pathname).toBe("/v1/payments/search");
    expect(url.searchParams.get("external_reference")).toBe(GATE4_ORDER);
    expect(url.searchParams.get("limit")).toBe("50");
  });
  it("paginates deterministically, rejects invalid offsets", () => {
    expect(new URL(searchUrl(50)).searchParams.get("offset")).toBe("50");
    expect(() => searchUrl(-1)).toThrow("invalid_page_offset");
    expect(() => searchUrl(200)).toThrow("invalid_page_offset");
    expect(remainingPages(101)).toBe(3);
    expect(completeSearch(200,200)).toBe(true);
    expect(completeSearch(201,200)).toBe(false);
  });
  it("sanitizes payments and discards payer, secrets and raw payload", () => {
    const result = sanitizePayments({
      paging: { total: 1 }, results: [{ ...row(123), payer: { email: "private@x.com" },
        token: "SECRET", description: "private", date_created: "2026-11-15T17:07:42Z" }],
    });
    expect(result.total).toBe(1);
    expect(result.payments[0]).toEqual({
      id: "123", status: "pending", amount: 30.99,
      external_reference: GATE4_ORDER, currency_id: "BRL",
      date_created: "2026-11-15T17:07:42Z",
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
  it("fails closed on wrong external reference or malformed gateway body", () => {
    expect(() => sanitizePayments({paging: {total:1}, results:[{...row(123),external_reference:"wrong"}]}))
      .toThrow("invalid_gateway_payment");
    expect(() => sanitizePayments({paging: {},results:[]})).toThrow("invalid_gateway_response");
    expect(() => sanitizePayments({paging: {total:0},results:[row(123)]})).toThrow("invalid_gateway_pagination");
  });
  it("requires caller JWT, auth.getUser and owner match", () => {
    expect(handler).toContain('Deno.env.get("SUPABASE_URL") !== GATE4_PROJECT');
    expect(handler).toContain('Deno.env.get("MP_ENVIRONMENT") !== "test"');
    expect(handler).toContain("sb.auth.getUser(jwt)");
    expect(handler).toContain("restaurant.owner_id !== auth.user.id");
  });
  it("reads encrypted seller OAuth and rejects unencrypted legacy tokens", () => {
    expect(handler).toContain('account.access_token.startsWith("v1:")');
    expect(handler).toContain("decryptToken(account.access_token)");
    expect(handler).toContain("assertMpSellerTokenMode");
    expect(handler).toContain("assertMpExpectedTestSeller");
  });
  it("does not permit gateway writes, SQL mutations or auto retry", () => {
    expect(handler).toContain('method: "GET"');
    expect(handler).not.toContain('method: "PUT"');
    expect(handler).not.toContain('method: "PATCH"');
    expect(handler).not.toContain('method: "DELETE"');
    expect(handler).not.toContain('method: "POST",');
    expect(handler).not.toMatch(/\.from\([^)]*\)\.(insert|update|upsert|delete)\(/);
    expect(handler).toContain("retry_allowed: false");
  });
});

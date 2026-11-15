import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const transitions = readFileSync(new URL("../_shared/order-transition.ts", import.meta.url), "utf8");

describe("Gate 4: Mercado Pago webhook sandbox isolation", () => {
  const sandboxGuard = source.indexOf(
    'Deno.env.get("MP_ENVIRONMENT") === "test" && !internalReplay',
  );
  const firstFinancialWrite = source.indexOf('.from("payment_webhook_events")');

  it("requires a valid HMAC before persistence of external events", () => {
    expect(sandboxGuard).toBeGreaterThan(-1);
    expect(sandboxGuard).toBeLessThan(firstFinancialWrite);
    expect(source.slice(sandboxGuard, firstFinancialWrite)).toContain("verifySignature");
    expect(source.slice(sandboxGuard, firstFinancialWrite)).toContain(
      "webhook_invalid_signature",
    );
  });

  it("blocks a missing mode or a non-isolated project before any writes", () => {
    expect(source.indexOf('error: "mp_webhook_environment_not_configured"')).toBeLessThan(
      firstFinancialWrite,
    );
    expect(source.indexOf('error: "sandbox_webhook_project_mismatch"')).toBeLessThan(
      firstFinancialWrite,
    );
  });

  it("keeps sandbox seller TEST-only and refuses cross-environment token", () => {
    expect(source).toContain("assertMpSellerTokenMode(environment, seller.live_mode, token)");
    expect(source).toContain("sandbox_seller_token_mismatch");
    expect(source).toContain("sandbox_seller_account_unavailable");
  });

  it("uses isolated transactional RPC in TEST and no external bearer", () => {
    const marker = transitions.indexOf('Deno.env.get("MP_ENVIRONMENT") === "test"');
    const url = transitions.indexOf('const url = Deno.env.get("INTERNAL_TRANSITION_URL")');
    expect(marker).toBeGreaterThan(-1);
    expect(marker).toBeLessThan(url);
    expect(transitions.slice(marker, url)).toContain(
      'transitionOrderDirect(req, "sandbox_direct_rpc")',
    );
    expect(transitions.slice(marker, url)).toContain("sandbox_transition_project_mismatch");
  });
});

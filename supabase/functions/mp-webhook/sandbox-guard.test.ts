import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("Gate 4: Mercado Pago webhook sandbox is fail-closed", () => {
  const sandboxGuard = source.indexOf('Deno.env.get("MP_ENVIRONMENT") === "test" && !internalReplay');
  const sandboxTransitionGate = source.indexOf('error: "sandbox_transition_not_homologated"');
  const firstFinancialWrite = source.indexOf('.from("payment_webhook_events")');

  it("verifies HMAC before persisting any external event", () => {
    expect(sandboxGuard).toBeGreaterThan(-1);
    expect(source.slice(sandboxGuard, sandboxTransitionGate)).toContain("verifySignature");
    expect(source.slice(sandboxGuard, sandboxTransitionGate)).toContain("webhook_invalid_signature");
    expect(sandboxTransitionGate).toBeLessThan(firstFinancialWrite);
  });

  it("refuses all sandbox financial transitions before transition RPC homologation", () => {
    expect(source).toContain("sandbox_transition_not_homologated");
    expect(source).toContain("status: 503");
    expect(source.indexOf('error: "sandbox_transition_not_homologated"')).toBeLessThan(
      firstFinancialWrite,
    );
  });
});

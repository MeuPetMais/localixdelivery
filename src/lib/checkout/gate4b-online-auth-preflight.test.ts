import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../routes/$slug.index.tsx", import.meta.url), "utf8");
const orderServiceSource = readFileSync(new URL("./OrderService.ts", import.meta.url), "utf8");
describe("Gate 4B: public checkout preflight before order persistence", () => {
  it("blocks online checkout without authenticated email BEFORE createCheckoutOrder", () => {
    const guard = source.indexOf("if (selectedPayment.online && !checkoutUser?.email)");
    const persist = source.indexOf("const res = await create({");
    expect(guard).toBeGreaterThan(-1);
    expect(persist).toBeGreaterThan(guard);
    expect(source.slice(guard, persist)).toContain('toast.error("Faça login com e-mail para pagar online")');
    expect(source.slice(guard, persist)).toContain("return;");
  });

  it("does not force authentication for offline payment selection", () => {
    expect(source).toContain("if (selectedPayment.online && !checkoutUser?.email)");
    expect(source).not.toContain("if (!checkoutUser?.email) {\n        toast.error");
  });

  it("preserves existing post-persistence defense before invoking PaymentService", () => {
    const persisted = source.indexOf("const res = await create({");
    const secondaryEmailGuard = source.indexOf("if (!email)", persisted);
    const mpInvoke = source.indexOf("PaymentService.createPayment({", persisted);
    expect(secondaryEmailGuard).toBeGreaterThan(persisted);
    expect(mpInvoke).toBeGreaterThan(secondaryEmailGuard);
  });
});


describe("Gate 4B: server-side online payment ownership preflight", () => {
  it("rejects pending payment without verified server user before atomic RPC", () => {
    const guard = orderServiceSource.indexOf('paymentDecision.paymentRecordStatus === "PENDING" && !context.userId');
    const creation = orderServiceSource.indexOf('"create_order_with_snapshot_payment"');
    expect(guard).toBeGreaterThan(-1);
    expect(creation).toBeGreaterThan(guard);
    expect(orderServiceSource).toContain('throw new Error("online_payment_auth_required")');
    expect(orderServiceSource).toContain('customer_id: context.userId ?? null');
  });

  it("keeps offline guests available (guard scoped only to pending online)", () => {
    expect(orderServiceSource).toContain('paymentDecision.paymentRecordStatus === "PENDING" && !context.userId');
    expect(orderServiceSource).toContain("_customer_id: context.userId ?? null");
  });
});

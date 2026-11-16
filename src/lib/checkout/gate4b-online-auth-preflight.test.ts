import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../routes/$slug.index.tsx", import.meta.url), "utf8");
const checkout = source.slice(
  source.indexOf("async function submit"),
  source.indexOf("return (", source.indexOf("const res = await create({")),
);

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

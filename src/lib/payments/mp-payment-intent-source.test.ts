import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sourcePath = new URL("../../../supabase/functions/mp-payment-intent/index.ts", import.meta.url);
const source = readFileSync(sourcePath, "utf8");

describe("mp-payment-intent PIX split", () => {
  it("usa application_fee vindo do order_pricing_snapshot", () => {
    expect(source).toContain('.from("order_pricing_snapshot")');
    expect(source).toContain('.select("platform_fee")');
    expect(source).toContain('.eq("order_id", orderId)');
    expect(source).toContain("application_fee: Number(params.platformFee.toFixed(2))");
    expect(source).toContain("platformFee,");
    expect(source).not.toContain("application_fee: 0.99");
  });

  it("bloqueia PIX quando snapshot estiver ausente ou platform_fee for invalido", () => {
    const snapshotLookup = source.indexOf('.from("order_pricing_snapshot")');
    const invalidGuard = source.indexOf('return json({ error: "invalid_platform_fee" }');
    const mpCreate = source.indexOf("mp = await createPixPayment");

    expect(snapshotLookup).toBeGreaterThan(-1);
    expect(source).toContain("rawPlatformFee === null");
    expect(source).toContain("rawPlatformFee === undefined");
    expect(source).toContain('rawPlatformFee === ""');
    expect(source).toContain("!Number.isFinite(platformFee)");
    expect(source).toContain("platformFee < 0");
    expect(invalidGuard).toBeGreaterThan(snapshotLookup);
    expect(mpCreate).toBeGreaterThan(invalidGuard);
  });

  it("gera idempotency key deterministica por order_id no PIX", () => {
    const idempotencyKey = (orderId: string) => `localix-mp-pix-${orderId}`;

    expect(idempotencyKey("order-1")).toBe(idempotencyKey("order-1"));
    expect(idempotencyKey("order-1")).not.toBe(idempotencyKey("order-2"));
    expect(source).toContain("idempotencyKey: `localix-mp-pix-${orderId}`");
    expect(source).toContain('"X-Idempotency-Key": params.idempotencyKey');

    const pixFunction = source.slice(
      source.indexOf("async function createPixPayment"),
      source.indexOf("type MpPayer"),
    );
    expect(pixFunction).not.toContain("crypto.randomUUID()");
  });

  it("envia application_fee no body PIX", () => {
    const pixFunction = source.slice(
      source.indexOf("async function createPixPayment"),
      source.indexOf("type MpPayer"),
    );

    expect(pixFunction).toContain("const body: Record<string, unknown>");
    expect(pixFunction).toContain("application_fee: Number(params.platformFee.toFixed(2))");
    expect(pixFunction).toContain('fetch("https://api.mercadopago.com/v1/payments"');
  });
});

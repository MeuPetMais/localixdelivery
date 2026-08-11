import { describe, expect, it } from "vitest";
import {
  MercadoPagoSplitError,
  assertSnapshotBelongsToRestaurant,
  buildCheckoutProSplitPayload,
  buildMpIdempotencyKey,
  buildMpRefundIdempotencyKey,
  buildPixSplitPayload,
  reconcileRefundReversal,
  reconcileMpMarketplaceFee,
  splitStatusForGatewayPayment,
  validateRefundRequest,
  validateMpSplitAmounts,
} from "./mercadopago-split";

describe("Mercado Pago split helpers", () => {
  it("Checkout Pro cliente paga: envia marketplace_fee sem somar taxa novamente", () => {
    expect(buildCheckoutProSplitPayload({
      orderId: "order-1",
      transactionAmount: 50.99,
      platformFee: 0.99,
    })).toEqual({
      external_reference: "order-1",
      marketplace_fee: 0.99,
    });
  });

  it("Checkout Pro restaurante paga: envia marketplace_fee sobre total do cliente", () => {
    expect(buildCheckoutProSplitPayload({
      orderId: "order-1",
      transactionAmount: 50,
      platformFee: 0.99,
    })).toEqual({
      external_reference: "order-1",
      marketplace_fee: 0.99,
    });
  });

  it("PIX cliente paga: envia transaction_amount e application_fee congelados", () => {
    expect(buildPixSplitPayload({
      orderId: "order-1",
      transactionAmount: 50.99,
      platformFee: 0.99,
    })).toEqual({
      external_reference: "order-1",
      transaction_amount: 50.99,
      application_fee: 0.99,
    });
  });

  it("PIX restaurante paga: nao adiciona platform_fee ao total do cliente", () => {
    expect(buildPixSplitPayload({
      orderId: "order-1",
      transactionAmount: 50,
      platformFee: 0.99,
    })).toEqual({
      external_reference: "order-1",
      transaction_amount: 50,
      application_fee: 0.99,
    });
  });

  it("fee zero omite parametro de split no gateway", () => {
    expect(buildCheckoutProSplitPayload({ orderId: "order-1", transactionAmount: 50, platformFee: 0 }))
      .toEqual({ external_reference: "order-1" });
    expect(buildPixSplitPayload({ orderId: "order-1", transactionAmount: 50, platformFee: 0 }))
      .toEqual({ external_reference: "order-1", transaction_amount: 50 });
  });

  it("recusa fee negativa", () => {
    expect(() => validateMpSplitAmounts({ transactionAmount: 50, platformFee: -0.01 }))
      .toThrow(MercadoPagoSplitError);
  });

  it("recusa fee maior ou igual ao total", () => {
    expect(() => validateMpSplitAmounts({ transactionAmount: 0.99, platformFee: 0.99 }))
      .toThrow("platform_fee_greater_or_equal_total");
    expect(() => validateMpSplitAmounts({ transactionAmount: 0.99, platformFee: 1 }))
      .toThrow("platform_fee_greater_or_equal_total");
  });

  it("gera idempotency key estavel por pedido e metodo", () => {
    const first = buildMpIdempotencyKey({ orderId: "order-1", paymentMethod: "pix" });
    const second = buildMpIdempotencyKey({ orderId: "order-1", paymentMethod: "pix" });
    expect(first).toBe(second);
    expect(first).not.toBe(buildMpIdempotencyKey({ orderId: "order-1", paymentMethod: "checkout_pro" }));
  });

  it("recusa snapshot de outro restaurante", () => {
    expect(() => assertSnapshotBelongsToRestaurant({
      orderRestaurantId: "restaurant-a",
      snapshotRestaurantId: "restaurant-b",
    })).toThrow("pricing_snapshot_restaurant_mismatch");
  });

  it("confirma pagamento aprovado quando fee realizada bate com esperada", () => {
    expect(reconcileMpMarketplaceFee({
      expectedPlatformFee: 0.99,
      payment: { marketplace_fee: 0.99 },
    })).toMatchObject({
      status: "COMPLETED",
      expectedPlatformFee: 0.99,
      realizedPlatformFee: 0.99,
      reason: null,
    });
  });

  it("encaminha divergencia de fee para revisao manual", () => {
    expect(reconcileMpMarketplaceFee({
      expectedPlatformFee: 0.99,
      payment: { marketplace_fee: 0.49 },
    })).toMatchObject({
      status: "MANUAL_REVIEW",
      expectedPlatformFee: 0.99,
      realizedPlatformFee: 0.49,
      reason: "marketplace_fee_divergent",
    });
  });

  it("encaminha fee ausente para revisao manual", () => {
    expect(reconcileMpMarketplaceFee({
      expectedPlatformFee: 0.99,
      payment: {},
    })).toMatchObject({
      status: "MANUAL_REVIEW",
      expectedPlatformFee: 0.99,
      realizedPlatformFee: null,
      reason: "marketplace_fee_missing",
    });
  });

  it("pagamento sem fee esperada finaliza split com receita realizada zero", () => {
    expect(reconcileMpMarketplaceFee({
      expectedPlatformFee: 0,
      payment: {},
    })).toMatchObject({
      status: "COMPLETED",
      realizedPlatformFee: 0,
      source: "zero_expected",
    });
  });

  it("resposta MP pendente mantem split em processamento", () => {
    expect(splitStatusForGatewayPayment("PENDING")).toBe("PROCESSING");
    expect(splitStatusForGatewayPayment("PROCESSING")).toBe("PROCESSING");
  });

  it("resposta MP recusada marca split como falho", () => {
    expect(splitStatusForGatewayPayment("REJECTED")).toBe("FAILED");
  });

  it("pagamento aprovado sem refund mantem receita realizada", () => {
    expect(reconcileRefundReversal({
      paymentStatus: "approved",
      transactionAmount: 50.99,
      expectedPlatformFee: 0.99,
      payment: { status: "approved" },
    })).toEqual({
      ok: true,
      reversalStatus: "NONE",
      refundedAmount: 0,
      reversedPlatformFee: 0,
      realizedPlatformRevenue: 0.99,
    });
  });

  it("refund total confirmado zera receita Localix proporcionalmente", () => {
    expect(reconcileRefundReversal({
      paymentStatus: "refunded",
      transactionAmount: 50.99,
      expectedPlatformFee: 0.99,
      payment: { status: "refunded" },
    })).toEqual({
      ok: true,
      reversalStatus: "FULL",
      refundedAmount: 50.99,
      reversedPlatformFee: 0.99,
      realizedPlatformRevenue: 0,
    });
  });

  it("refund parcial usa valor confirmado pelo MP e reverte fee proporcional", () => {
    expect(reconcileRefundReversal({
      paymentStatus: "approved",
      paymentStatusDetail: "partially_refunded",
      transactionAmount: 100,
      expectedPlatformFee: 10,
      payment: { refunds: [{ amount: 25 }] },
    })).toEqual({
      ok: true,
      reversalStatus: "PARTIAL",
      refundedAmount: 25,
      reversedPlatformFee: 2.5,
      realizedPlatformRevenue: 7.5,
    });
  });

  it("refund parcial sem valor confirmado vai para revisao manual", () => {
    expect(reconcileRefundReversal({
      paymentStatus: "approved",
      paymentStatusDetail: "partially_refunded",
      transactionAmount: 100,
      expectedPlatformFee: 10,
      payment: {},
    })).toEqual({ ok: false, reason: "refund_amount_missing" });
  });

  it("refund solicitado mas ainda nao confirmado nao altera receita realizada", () => {
    const request = validateRefundRequest({
      paymentStatus: "approved",
      transactionAmount: 50.99,
      alreadyRefundedAmount: 0,
      requestedAmount: null,
    });
    expect(request.refundAmount).toBe(50.99);
    expect(reconcileRefundReversal({
      paymentStatus: "approved",
      transactionAmount: 50.99,
      expectedPlatformFee: 0.99,
      payment: {},
    })).toMatchObject({ ok: true, realizedPlatformRevenue: 0.99 });
  });

  it("refund duplicado usa chave idempotente estavel", () => {
    const first = buildMpRefundIdempotencyKey({ paymentId: "mp-1", alreadyRefundedAmount: 0, refundAmount: 10 });
    const second = buildMpRefundIdempotencyKey({ paymentId: "mp-1", alreadyRefundedAmount: 0, refundAmount: 10 });
    expect(first).toBe(second);
  });

  it("refund maior que pagamento ou saldo reembolsavel e recusado", () => {
    expect(() => validateRefundRequest({
      paymentStatus: "approved",
      transactionAmount: 50,
      alreadyRefundedAmount: 0,
      requestedAmount: 51,
    })).toThrow("refund_amount_exceeds");
    expect(() => validateRefundRequest({
      paymentStatus: "approved",
      transactionAmount: 50,
      alreadyRefundedAmount: 40,
      requestedAmount: 11,
    })).toThrow("refund_amount_exceeds");
  });

  it("token/status nao aprovado falha antes do refund", () => {
    expect(() => validateRefundRequest({
      paymentStatus: "pending",
      transactionAmount: 50,
      alreadyRefundedAmount: 0,
      requestedAmount: 10,
    })).toThrow("invalid_payment_status_to_refund");
  });
});

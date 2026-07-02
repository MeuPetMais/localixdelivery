import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleWebhook, mapStatus, eventNameFromStatus, verifyMpSignature, type WebhookDeps } from "./WebhookService";
import { EventBus } from "./EventBus";

function makeDeps(overrides: Partial<WebhookDeps> = {}): WebhookDeps {
  return {
    storeEvent: vi.fn(async () => ({ id: "evt-1", duplicated: false })),
    markProcessed: vi.fn(async () => {}),
    enqueueRetry: vi.fn(async () => {}),
    fetchMpPayment: vi.fn(async () => ({
      id: 123, status: "approved", transaction_amount: 50, currency_id: "BRL",
      external_reference: "order-xyz",
    })),
    updateOrderPayment: vi.fn(async () => {}),
    updateOrder: vi.fn(async () => {}),
    recordLedger: vi.fn(async () => {}),
    getOrderByPayment: vi.fn(async () => ({ orderId: "order-xyz", restaurantId: "rest-1" })),
    ...overrides,
  };
}

function payload(overrides: Record<string, any> = {}) {
  return {
    id: "notif-1",
    type: "payment",
    action: "payment.updated",
    data: { id: "123" },
    ...overrides,
  };
}

describe("WebhookService - núcleo", () => {
  beforeEach(() => EventBus._reset());

  it("mapStatus cobre todos os estados", () => {
    expect(mapStatus("approved")).toBe("APPROVED");
    expect(mapStatus("in_process")).toBe("PROCESSING");
    expect(mapStatus("pending")).toBe("PENDING");
    expect(mapStatus("rejected")).toBe("REJECTED");
    expect(mapStatus("cancelled")).toBe("CANCELLED");
    expect(mapStatus("refunded")).toBe("REFUNDED");
    expect(mapStatus("charged_back")).toBe("CHARGEBACK");
    expect(mapStatus("expired")).toBe("EXPIRED");
    expect(mapStatus(null)).toBe("PENDING");
  });

  it("eventNameFromStatus mapeia corretamente", () => {
    expect(eventNameFromStatus("APPROVED")).toBe("PaymentApproved");
    expect(eventNameFromStatus("REFUNDED")).toBe("PaymentRefunded");
    expect(eventNameFromStatus("CHARGEBACK")).toBe("PaymentChargeback");
  });

  it("verifyMpSignature retorna true sem secret", async () => {
    const ok = await verifyMpSignature({ secret: null, xSignature: null, xRequestId: null, dataId: null });
    expect(ok).toBe(true);
  });

  it("verifyMpSignature rejeita assinatura ausente quando secret existe", async () => {
    const ok = await verifyMpSignature({ secret: "s", xSignature: null, xRequestId: "r", dataId: "1" });
    expect(ok).toBe(false);
  });
});

describe("handleWebhook - fluxos", () => {
  beforeEach(() => EventBus._reset());

  it("pagamento aprovado: atualiza tudo e publica PaymentApproved", async () => {
    const published: any[] = [];
    EventBus.subscribe((name, p) => { published.push({ name, p }); });
    const deps = makeDeps();
    const out = await handleWebhook(deps, {
      headers: {}, rawBody: JSON.stringify(payload()), parsed: payload(),
    });
    expect(out.ok).toBe(true);
    expect(out.status).toBe("APPROVED");
    expect(out.eventName).toBe("PaymentApproved");
    expect(deps.updateOrder).toHaveBeenCalledWith("order-xyz", { status: "novo" });
    expect(deps.recordLedger).toHaveBeenCalledWith(expect.objectContaining({ transactionType: "PAYMENT_APPROVED", amount: 50 }));
    expect(published[0]?.name).toBe("PaymentApproved");
  });

  it("evento duplicado: não processa", async () => {
    const deps = makeDeps({ storeEvent: vi.fn(async () => ({ id: "evt-1", duplicated: true })) });
    const out = await handleWebhook(deps, { headers: {}, rawBody: "{}", parsed: payload() });
    expect(out.duplicated).toBe(true);
    expect(deps.fetchMpPayment).not.toHaveBeenCalled();
    expect(deps.recordLedger).not.toHaveBeenCalled();
  });

  it("pagamento rejeitado: registra PAYMENT_FAILED", async () => {
    const deps = makeDeps({
      fetchMpPayment: vi.fn(async () => ({ id: 1, status: "rejected", transaction_amount: 10, currency_id: "BRL" })) as any,
    });
    const out = await handleWebhook(deps, { headers: {}, rawBody: "{}", parsed: payload() });
    expect(out.status).toBe("REJECTED");
    expect(deps.recordLedger).toHaveBeenCalledWith(expect.objectContaining({ transactionType: "PAYMENT_FAILED" }));
    expect(deps.updateOrder).not.toHaveBeenCalled();
  });

  it("pagamento pendente: registra PAYMENT_PENDING", async () => {
    const deps = makeDeps({
      fetchMpPayment: vi.fn(async () => ({ id: 1, status: "pending", transaction_amount: 10 })) as any,
    });
    const out = await handleWebhook(deps, { headers: {}, rawBody: "{}", parsed: payload() });
    expect(out.status).toBe("PENDING");
    expect(deps.recordLedger).toHaveBeenCalledWith(expect.objectContaining({ transactionType: "PAYMENT_PENDING" }));
  });

  it("pagamento expirado: registra PAYMENT_FAILED", async () => {
    const deps = makeDeps({
      fetchMpPayment: vi.fn(async () => ({ id: 1, status: "expired", transaction_amount: 10 })) as any,
    });
    const out = await handleWebhook(deps, { headers: {}, rawBody: "{}", parsed: payload() });
    expect(out.status).toBe("EXPIRED");
    expect(deps.recordLedger).toHaveBeenCalledWith(expect.objectContaining({ transactionType: "PAYMENT_FAILED" }));
  });

  it("estorno: registra REFUND", async () => {
    const deps = makeDeps({
      fetchMpPayment: vi.fn(async () => ({ id: 1, status: "refunded", transaction_amount: 10 })) as any,
    });
    const out = await handleWebhook(deps, { headers: {}, rawBody: "{}", parsed: payload() });
    expect(out.status).toBe("REFUNDED");
    expect(deps.recordLedger).toHaveBeenCalledWith(expect.objectContaining({ transactionType: "REFUND" }));
  });

  it("chargeback: registra CHARGEBACK", async () => {
    const deps = makeDeps({
      fetchMpPayment: vi.fn(async () => ({ id: 1, status: "charged_back", transaction_amount: 10 })) as any,
    });
    const out = await handleWebhook(deps, { headers: {}, rawBody: "{}", parsed: payload() });
    expect(out.status).toBe("CHARGEBACK");
    expect(deps.recordLedger).toHaveBeenCalledWith(expect.objectContaining({ transactionType: "CHARGEBACK" }));
  });

  it("erro no processamento: enfileira para retry", async () => {
    const deps = makeDeps({
      fetchMpPayment: vi.fn(async () => { throw new Error("boom"); }) as any,
    });
    const out = await handleWebhook(deps, { headers: {}, rawBody: "{}", parsed: payload() });
    expect(out.ok).toBe(false);
    expect(deps.enqueueRetry).toHaveBeenCalled();
    expect(deps.markProcessed).toHaveBeenCalledWith("evt-1", false, "boom");
  });

  it("evento não-payment: marca processado e ignora", async () => {
    const deps = makeDeps();
    const out = await handleWebhook(deps, {
      headers: {}, rawBody: "{}",
      parsed: { id: "x", type: "merchant_order", data: { id: "999" } },
    });
    expect(out.ok).toBe(true);
    expect(out.reason).toBe("ignored");
    expect(deps.fetchMpPayment).not.toHaveBeenCalled();
  });

  it("pedido não encontrado: marca processado com aviso", async () => {
    const deps = makeDeps({ getOrderByPayment: vi.fn(async () => null) });
    const out = await handleWebhook(deps, { headers: {}, rawBody: "{}", parsed: payload() });
    expect(out.ok).toBe(true);
    expect(out.reason).toBe("order_not_found");
    expect(deps.recordLedger).not.toHaveBeenCalled();
  });
});

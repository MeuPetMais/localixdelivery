import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapMpStatus } from "./PaymentIntentService";

// Mock do client.server usado dentro das server functions.
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { functions: { invoke: (...a: any[]) => invoke(...a) } },
}));

// Importa após o mock para garantir binding.
import {
  createPaymentIntent,
  getPaymentIntentStatus,
  cancelPaymentIntent,
} from "./PaymentIntentService";

// Helper: as server functions expõem __executeServer no bundle de teste.
// Fallback: chamamos com { data } se o adapter estiver disponível.
async function call(fn: any, data: any) {
  if (typeof fn === "function") return await fn({ data });
  return await fn.handler({ data });
}

beforeEach(() => invoke.mockReset());

describe("PaymentIntentService.mapMpStatus", () => {
  it("mapeia status do MP para o dicionário local", () => {
    expect(mapMpStatus("approved")).toBe("APPROVED");
    expect(mapMpStatus("in_process")).toBe("PROCESSING");
    expect(mapMpStatus("rejected")).toBe("REJECTED");
    expect(mapMpStatus("cancelled")).toBe("CANCELLED");
    expect(mapMpStatus("pending")).toBe("PENDING");
    expect(mapMpStatus(null)).toBe("PENDING");
  });
});

describe("PaymentIntentService.createPaymentIntent", () => {
  const orderId = "11111111-1111-1111-1111-111111111111";

  it("cria Pix com QR Code", async () => {
    invoke.mockResolvedValue({
      data: {
        payment_id: "MP-123",
        status: "PENDING",
        qr_code: "PIX-COPIA-COLA",
        qr_code_base64: "BASE64==",
        payment_url: "https://mp/ticket",
        expiration_date: "2030-01-01T00:00:00Z",
      },
      error: null,
    });
    const r = await call(createPaymentIntent, { orderId, paymentMethod: "pix" });
    expect(invoke).toHaveBeenCalledWith("mp-payment-intent", expect.objectContaining({
      body: expect.objectContaining({ action: "create", order_id: orderId, payment_method: "pix" }),
    }));
    expect(r.payment_id).toBe("MP-123");
    expect(r.qr_code).toBe("PIX-COPIA-COLA");
    expect(r.qr_code_base64).toBe("BASE64==");
    expect(r.status).toBe("PENDING");
  });

  it("cartão retorna pending: true (implementação futura)", async () => {
    invoke.mockResolvedValue({
      data: { pending: true, message: "Cartão em breve", payment_id: null, status: "PENDING" },
      error: null,
    });
    const r = await call(createPaymentIntent, { orderId, paymentMethod: "credit_card" });
    expect(r.pending).toBe(true);
    expect(r.payment_id).toBeNull();
  });

  it("propaga erro do Mercado Pago", async () => {
    invoke.mockResolvedValue({ data: { error: "invalid access token" }, error: null });
    await expect(call(createPaymentIntent, { orderId, paymentMethod: "pix" }))
      .rejects.toThrow(/invalid access token/i);
  });

  it("propaga erro de pedido inexistente da Edge Function", async () => {
    invoke.mockResolvedValue({ data: { error: "Pedido não encontrado" }, error: null });
    await expect(call(createPaymentIntent, { orderId, paymentMethod: "pix" }))
      .rejects.toThrow(/não encontrado/i);
  });

  it("valida orderId (uuid) — rejeita input inválido", async () => {
    await expect(call(createPaymentIntent, { orderId: "nope", paymentMethod: "pix" }))
      .rejects.toBeTruthy();
  });
});

describe("PaymentIntentService.status/cancel", () => {
  const orderId = "22222222-2222-2222-2222-222222222222";

  it("consulta status", async () => {
    invoke.mockResolvedValue({ data: { status: "APPROVED", payment_id: "MP-9" }, error: null });
    const r = await call(getPaymentIntentStatus, { orderId });
    expect(r.status).toBe("APPROVED");
    expect(r.payment_id).toBe("MP-9");
  });

  it("cancela pagamento", async () => {
    invoke.mockResolvedValue({ data: { status: "CANCELLED" }, error: null });
    const r = await call(cancelPaymentIntent, { orderId });
    expect(r.status).toBe("CANCELLED");
  });
});

// Testes do Provider Pattern + PaymentService.createPayment.
// Validam: validação de entrada, roteamento por providerId e delegação
// ao provider correto (sem tocar em edge functions).

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do supabase client para MercadoPagoProvider/StripeProvider.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { PaymentService } from "./PaymentService";
import { paymentProviders, DEFAULT_PROVIDER_ID } from "./providers";
import { supabase } from "@/integrations/supabase/client";

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

const baseInput = {
  restaurantId: "r1",
  orderId: "o1",
  method: "card" as const,
  amount: 49.9,
  customerEmail: "cliente@exemplo.com",
  successUrl: "https://app.test/ok",
  cancelUrl: "https://app.test/cancel",
};

beforeEach(() => invoke.mockReset());

describe("PaymentService.createPayment", () => {
  it("default provider é Stripe", () => {
    expect(DEFAULT_PROVIDER_ID).toBe("stripe");
    expect(paymentProviders.stripe).toBeTruthy();
    expect(paymentProviders.mercado_pago).toBeTruthy();
  });

  it("exige customerEmail válido", async () => {
    await expect(
      PaymentService.createPayment({ ...baseInput, customerEmail: "" }),
    ).rejects.toThrow(/customerEmail/i);
    await expect(
      PaymentService.createPayment({ ...baseInput, customerEmail: "invalido" }),
    ).rejects.toThrow(/customerEmail/i);
  });

  it("exige orderId, restaurantId, amount e URLs", async () => {
    await expect(
      PaymentService.createPayment({ ...baseInput, orderId: "" as any }),
    ).rejects.toThrow(/orderId/);
    await expect(
      PaymentService.createPayment({ ...baseInput, amount: 0 }),
    ).rejects.toThrow(/amount/);
    await expect(
      PaymentService.createPayment({ ...baseInput, successUrl: "" }),
    ).rejects.toThrow(/successUrl|cancelUrl/);
  });

  it("roteia para Stripe (default) via edge stripe-checkout", async () => {
    invoke.mockResolvedValueOnce({
      data: { url: "https://stripe/checkout/cs_1", sessionId: "cs_1" },
      error: null,
    });
    const r = await PaymentService.createPayment(baseInput);
    expect(invoke).toHaveBeenCalledWith("stripe-checkout", expect.objectContaining({
      body: expect.objectContaining({
        orderId: "o1",
        method: "card",
        customerEmail: "cliente@exemplo.com",
      }),
    }));
    expect(r.provider).toBe("stripe");
    expect(r.redirectUrl).toBe("https://stripe/checkout/cs_1");
    expect(r.externalId).toBe("cs_1");
  });

  it("roteia para Mercado Pago quando providerId=mercado_pago", async () => {
    invoke.mockResolvedValueOnce({
      data: {
        payment_id: "mp_123",
        status: "PENDING",
        qr_code: "qr",
        qr_code_base64: "b64",
        payment_url: "https://mp/ticket",
        expiration_date: "2026-01-01T00:00:00Z",
      },
      error: null,
    });
    const r = await PaymentService.createPayment({
      ...baseInput,
      providerId: "mercado_pago",
      method: "pix",
    });
    expect(invoke).toHaveBeenCalledWith("mp-payment-intent", expect.objectContaining({
      body: expect.objectContaining({
        action: "create",
        order_id: "o1",
        payment_method: "pix",
        payer_email: "cliente@exemplo.com",
      }),
    }));
    expect(r.provider).toBe("mercado_pago");
    expect(r.pix?.qrCode).toBe("qr");
  });

  it("propaga erros do provider", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(PaymentService.createPayment(baseInput)).rejects.toThrow(/boom/);
  });

  it("rejeita providerId desconhecido", async () => {
    await expect(
      PaymentService.createPayment({ ...baseInput, providerId: "inexistente" }),
    ).rejects.toThrow(/desconhecido/i);
  });
});

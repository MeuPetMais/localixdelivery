import { describe, it, expect, vi } from "vitest";
import { mapMpStatus, runIntent } from "./PaymentIntentService";

describe("mapMpStatus", () => {
  it("mapeia status do Mercado Pago para dicionário local", () => {
    expect(mapMpStatus("approved")).toBe("APPROVED");
    expect(mapMpStatus("in_process")).toBe("PROCESSING");
    expect(mapMpStatus("rejected")).toBe("REJECTED");
    expect(mapMpStatus("cancelled")).toBe("CANCELLED");
    expect(mapMpStatus("pending")).toBe("PENDING");
    expect(mapMpStatus(null)).toBe("PENDING");
  });
});

describe("runIntent — create (Pix)", () => {
  it("retorna QR Code, copia-e-cola e expiração", async () => {
    const invoke = vi.fn().mockResolvedValue({
      payment_id: "MP-1",
      status: "PENDING",
      qr_code: "PIX-COPIA-COLA",
      qr_code_base64: "BASE64==",
      payment_url: "https://mp/ticket",
      expiration_date: "2030-01-01T00:00:00Z",
    });
    const r = await runIntent(invoke, "create", { order_id: "o1", payment_method: "pix" });
    expect(invoke).toHaveBeenCalledWith({ action: "create", order_id: "o1", payment_method: "pix" });
    expect(r.payment_id).toBe("MP-1");
    expect(r.qr_code).toBe("PIX-COPIA-COLA");
    expect(r.qr_code_base64).toBe("BASE64==");
    expect(r.expiration_date).toBe("2030-01-01T00:00:00Z");
    expect(r.status).toBe("PENDING");
  });
});

describe("runIntent — create (cartão)", () => {
  it("retorna pending: true para cartão (estrutura pronta)", async () => {
    const invoke = vi.fn().mockResolvedValue({
      pending: true,
      message: "Cartão em breve",
      payment_id: null,
      status: "PENDING",
    });
    const r = await runIntent(invoke, "create", { order_id: "o1", payment_method: "credit_card" });
    expect(r.pending).toBe(true);
    expect(r.payment_id).toBeNull();
    expect(r.status).toBe("PENDING");
  });
});

describe("runIntent — erros", () => {
  it("propaga erro do Mercado Pago", async () => {
    const invoke = vi.fn().mockResolvedValue({ error: "invalid access token" });
    await expect(runIntent(invoke, "create", { order_id: "o1" })).rejects.toThrow(/invalid access token/i);
  });

  it("propaga erro de pedido inexistente", async () => {
    const invoke = vi.fn().mockResolvedValue({ error: "Pedido não encontrado" });
    await expect(runIntent(invoke, "create", { order_id: "o1" })).rejects.toThrow(/não encontrado/i);
  });

  it("propaga exceção lançada pelo invoke (falha de rede)", async () => {
    const invoke = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(runIntent(invoke, "create", { order_id: "o1" })).rejects.toThrow(/network down/i);
  });
});

describe("runIntent — status / cancel", () => {
  it("consulta status", async () => {
    const invoke = vi.fn().mockResolvedValue({ status: "APPROVED", payment_id: "MP-9" });
    const r = await runIntent(invoke, "status", { order_id: "o1" });
    expect(r.status).toBe("APPROVED");
    expect(r.payment_id).toBe("MP-9");
  });

  it("cancela pagamento", async () => {
    const invoke = vi.fn().mockResolvedValue({ status: "CANCELLED" });
    const r = await runIntent(invoke, "cancel", { order_id: "o1" });
    expect(r.status).toBe("CANCELLED");
  });
});

// Testes da Central de Gateways — getPrimaryProvider / setPrimaryProvider.
import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke }, from: (...a: any[]) => from(...a) },
}));

import { PaymentService } from "./PaymentService";

beforeEach(() => {
  invoke.mockReset();
  from.mockReset();
});

function chain(result: any) {
  const q: any = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => result,
    update: () => q,
  };
  return q;
}

describe("PaymentService gateway principal", () => {
  it("getPrimaryProvider retorna default quando restaurante não tem valor", async () => {
    from.mockReturnValue(chain({ data: null }));
    const p = await PaymentService.getPrimaryProvider("r1");
    expect(p).toBe("stripe");
  });

  it("getPrimaryProvider retorna valor persistido", async () => {
    from.mockReturnValue(chain({ data: { payment_provider: "mercado_pago" } }));
    const p = await PaymentService.getPrimaryProvider("r1");
    expect(p).toBe("mercado_pago");
  });

  it("setPrimaryProvider rejeita provider desconhecido", async () => {
    await expect(PaymentService.setPrimaryProvider("r1", "xyz")).rejects.toThrow(/inválido/i);
  });

  it("setPrimaryProvider persiste valor válido", async () => {
    const upd = { eq: () => ({ error: null }) };
    from.mockReturnValue({ update: () => upd });
    await expect(PaymentService.setPrimaryProvider("r1", "mercado_pago")).resolves.toBeUndefined();
  });
});

// Testes da Central de Gateways — getPrimaryProvider / setPrimaryProvider.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, from: vi.fn() },
}));

import { PaymentService } from "./PaymentService";
import { supabase } from "@/integrations/supabase/client";
const from = supabase.from as unknown as ReturnType<typeof vi.fn>;


beforeEach(() => {
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

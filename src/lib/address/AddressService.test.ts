import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAddressService } from "./AddressService";

const store = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};
beforeEach(() => store.clear());
import type { AddressProvider, AddressSuggestion, AddressDetails } from "./types";

const sample: AddressSuggestion = { id: "1", label: "Av. Paulista, 1578", secondary: "Bela Vista — São Paulo/SP" };
const details: AddressDetails = {
  id: "1", street: "Av. Paulista", number: "1578", neighborhood: "Bela Vista",
  city: "São Paulo", state: "SP", cep: "01310200", lat: -23.56, lng: -46.65,
  label: sample.label, secondary: sample.secondary,
};

function makeProvider(overrides: Partial<AddressProvider> = {}): AddressProvider {
  return {
    id: "mock",
    search: vi.fn(async (q: string) => (q.length < 3 ? [] : [sample])),
    details: vi.fn(async () => details),
    ...overrides,
  };
}

describe("AddressService", () => {
  it("ignora consulta curta", async () => {
    const p = makeProvider();
    const s = createAddressService(p);
    expect(await s.search("av")).toEqual([]);
    expect(p.search).not.toHaveBeenCalled();
  });

  it("retorna sugestões do provider", async () => {
    const s = createAddressService(makeProvider());
    const r = await s.search("avenida paulista");
    expect(r).toHaveLength(1);
    expect(r[0].label).toContain("Paulista");
  });

  it("details grava no cache de recentes", async () => {
    const s = createAddressService(makeProvider());
    await s.details(sample);
    expect(s.getRecent()[0].id).toBe("1");
  });

  it("validateDeliveryArea aceita coordenadas válidas", async () => {
    const s = createAddressService(makeProvider());
    const res = await s.validateDeliveryArea(details);
    expect(res.ok).toBe(true);
  });

  it("validateDeliveryArea rejeita coordenadas inválidas", async () => {
    const s = createAddressService(makeProvider());
    const res = await s.validateDeliveryArea({ ...details, lat: NaN, lng: NaN });
    expect(res.ok).toBe(false);
  });
});

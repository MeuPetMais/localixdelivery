import { describe, it, expect, vi } from "vitest";
import { PurchasingService } from "./PurchasingService";
import { ReceivingService } from "./ReceivingService";
import { QuotationEngine } from "./QuotationEngine";
import { ReplenishmentEngine } from "./ReplenishmentEngine";
import { PurchaseSuggestionEngine } from "./PurchaseSuggestionEngine";
import { SupplierRanking } from "./SupplierRanking";
import { PurchaseEventBus } from "./PurchaseEventBus";
import type { PurchasingRepository, PurchaseRequest, Supplier, SupplierQuote } from "./types";

function memRepo(): PurchasingRepository {
  const suppliers = new Map<string, Supplier>();
  const requests = new Map<string, PurchaseRequest>();
  const quotes: SupplierQuote[] = [];
  let seq = 1;
  return {
    async listSuppliers(rid) { return [...suppliers.values()].filter(s => s.restaurant_id === rid); },
    async getSupplier(id) { return suppliers.get(id) ?? null; },
    async upsertSupplier(s) {
      const id = s.id ?? `sup${seq++}`;
      const rec: Supplier = { active: true, name: s.name ?? "", ...s, id } as Supplier;
      suppliers.set(id, rec);
      return rec;
    },
    async listSupplierProducts() { return []; },
    async createRequest(input) {
      const id = `req${seq++}`;
      const rec: PurchaseRequest = {
        id, restaurant_id: input.restaurant_id, status: input.status ?? "OPEN",
        items: input.items, reason: input.reason, requested_by: input.requested_by,
        approved_by: input.approved_by, notes: input.notes,
        created_at: new Date().toISOString(),
      };
      requests.set(id, rec);
      return rec;
    },
    async updateRequestStatus(id, status, actor) {
      const r = requests.get(id)!;
      const next = { ...r, status, approved_by: status === "APPROVED" ? actor ?? null : r.approved_by };
      requests.set(id, next);
      return next;
    },
    async listRequests(rid) { return [...requests.values()].filter(r => r.restaurant_id === rid); },
    async createQuote(q) {
      const rec = { id: `q${seq++}`, ...q } as SupplierQuote;
      quotes.push(rec);
      return rec;
    },
    async listQuotes(f) {
      return quotes.filter(q => q.restaurant_id === f.restaurant_id && (!f.ingredient_id || q.ingredient_id === f.ingredient_id));
    },
  };
}

describe("PurchasingService", () => {
  it("cria fornecedor e emite evento", async () => {
    const svc = new PurchasingService(memRepo());
    const handler = vi.fn();
    const off = PurchaseEventBus.on(handler);
    const sup = await svc.createSupplier({ restaurant_id: "r1", name: "F1" });
    off();
    expect(sup.name).toBe("F1");
    expect(handler).toHaveBeenCalled();
  });

  it("cria e aprova pedido de compra", async () => {
    const svc = new PurchasingService(memRepo());
    const req = await svc.requestPurchase({
      restaurant_id: "r1",
      items: [{ ingredient_id: "i1", quantity: 5 }],
      requested_by: "u1",
    });
    expect(req.status).toBe("OPEN");
    const approved = await svc.approveRequest(req.id, "boss");
    expect(approved.status).toBe("APPROVED");
    expect(approved.approved_by).toBe("boss");
  });

  it("rejeita pedido vazio", async () => {
    const svc = new PurchasingService(memRepo());
    await expect(svc.requestPurchase({ restaurant_id: "r1", items: [] })).rejects.toThrow();
  });
});

describe("QuotationEngine", () => {
  const quotes: SupplierQuote[] = [
    { id: "1", restaurant_id: "r", supplier_id: "A", ingredient_id: "i", price: 10, delivery_time: 5 },
    { id: "2", restaurant_id: "r", supplier_id: "B", ingredient_id: "i", price: 8,  delivery_time: 10 },
    { id: "3", restaurant_id: "r", supplier_id: "C", ingredient_id: "i", price: 9,  delivery_time: 3 },
  ];
  it("escolhe menor preço em best()", () => {
    expect(QuotationEngine.best(quotes)?.supplier_id).toBe("B");
  });
  it("compare pondera preço/prazo/qualidade", () => {
    const ranked = QuotationEngine.compare(quotes, new Map([["C", 5]]));
    expect(ranked[0].supplier_id).toBe("C");
  });
});

describe("ReplenishmentEngine + Suggestions", () => {
  it("gera ponto de reposição e sinaliza urgência", () => {
    const r = ReplenishmentEngine.calculate({
      currentStock: 5, minStock: 10, avgDailyConsumption: 2, leadTimeDays: 3,
    });
    expect(r.reorderPoint).toBeGreaterThan(0);
    expect(r.urgent).toBe(true);
    expect(r.suggestedQuantity).toBeGreaterThan(0);
  });
  it("PurchaseSuggestionEngine ordena por urgência", () => {
    const s = PurchaseSuggestionEngine.suggest([
      { ingredient_id: "a", currentStock: 100, avgDailyConsumption: 1, leadTimeDays: 2, unitCost: 5 },
      { ingredient_id: "b", currentStock: 1, minStock: 5, avgDailyConsumption: 3, leadTimeDays: 2, unitCost: 10 },
    ]);
    expect(s[0].ingredient_id).toBe("b");
    expect(s[0].urgent).toBe(true);
  });
});

describe("SupplierRanking", () => {
  it("ranqueia por preço, entrega, qualidade e volume", () => {
    const r = SupplierRanking.rank([
      { supplier_id: "A", avgPrice: 10, onTimeDeliveryRate: 0.9, qualityRating: 4, totalOrders: 30 },
      { supplier_id: "B", avgPrice: 15, onTimeDeliveryRate: 0.6, qualityRating: 3, totalOrders: 5 },
    ]);
    expect(r[0].supplier_id).toBe("A");
  });
});

describe("ReceivingService", () => {
  it("atualiza estoque e custo médio ao receber", async () => {
    const inv = { increaseStock: vi.fn().mockResolvedValue({}) };
    const cost = { calculateIngredientCost: vi.fn().mockResolvedValue({}) };
    const recv = new ReceivingService(inv, cost, "r1");
    const res = await recv.receive([
      { ingredient_id: "i1", quantity: 10, unit_cost: 5, supplier_id: "s1", batch_code: "L1" },
    ], { purchaseOrderId: "po1", performedBy: "u1" });
    expect(res.received).toBe(1);
    expect(inv.increaseStock).toHaveBeenCalledTimes(1);
    expect(cost.calculateIngredientCost).toHaveBeenCalledWith(expect.objectContaining({
      ingredient_id: "i1", unit_cost: 5, addedQty: 10, restaurant_id: "r1",
    }));
  });
});

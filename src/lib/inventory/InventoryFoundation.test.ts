import { describe, it, expect, beforeEach } from "vitest";
import { createInventoryService, type InventoryRepository } from "./InventoryService";
import { createPurchaseOrderService, type PurchaseOrderRepository } from "./PurchaseOrderService";
import { evaluateAlerts } from "./StockAlerts";
import { MarginEngine } from "./MarginEngine";
import { CostEngine } from "./CostEngine";
import { InventoryAudit } from "./InventoryAudit";
import { InventoryEventBus } from "./InventoryEventBus";
import type { Ingredient, PurchaseOrder, PurchaseOrderItem, StockMovement } from "./types";

function makeRepo(seed: Ingredient[]): InventoryRepository & { movements: StockMovement[] } {
  const store = new Map(seed.map((i) => [i.id, { ...i }]));
  const movements: StockMovement[] = [];
  return {
    movements,
    async getIngredient(id) { return store.get(id) ?? null; },
    async listIngredients(rid) { return [...store.values()].filter((i) => i.restaurant_id === rid); },
    async updateIngredient(id, patch) {
      const cur = store.get(id)!; const next = { ...cur, ...patch } as Ingredient;
      store.set(id, next); return next;
    },
    async recordMovement(m) {
      const full = { ...m, id: String(movements.length + 1), created_at: new Date().toISOString() } as StockMovement;
      movements.push(full); return full;
    },
  };
}

const baseIng = (over: Partial<Ingredient> = {}): Ingredient => ({
  id: "i1", restaurant_id: "r1", name: "Queijo", unit: "kg",
  stock: 10, reserved_stock: 0, min_stock: 2, unit_cost: 30, active: true, ...over,
});

describe("InventoryService", () => {
  beforeEach(() => { InventoryAudit.clear(); InventoryEventBus.clear(); });

  it("entry increases stock and records movement", async () => {
    const repo = makeRepo([baseIng()]);
    const svc = createInventoryService(repo);
    await svc.increaseStock({ ingredientId: "i1", quantity: 5 });
    const [ing] = await repo.listIngredients("r1");
    expect(ing.stock).toBe(15);
    expect(repo.movements[0].movement_type).toBe("ENTRY");
  });

  it("exit decreases stock", async () => {
    const repo = makeRepo([baseIng()]);
    const svc = createInventoryService(repo);
    await svc.decreaseStock({ ingredientId: "i1", quantity: 3 });
    const [ing] = await repo.listIngredients("r1");
    expect(ing.stock).toBe(7);
  });

  it("rejects exit above available stock", async () => {
    const repo = makeRepo([baseIng({ stock: 2 })]);
    const svc = createInventoryService(repo);
    await expect(svc.decreaseStock({ ingredientId: "i1", quantity: 5 })).rejects.toThrow();
  });

  it("reserve then release restores availability", async () => {
    const repo = makeRepo([baseIng()]);
    const svc = createInventoryService(repo);
    await svc.reserveStock({ ingredientId: "i1", quantity: 4 });
    let [ing] = await repo.listIngredients("r1");
    expect(ing.reserved_stock).toBe(4);
    await svc.releaseStock({ ingredientId: "i1", quantity: 4 });
    [ing] = await repo.listIngredients("r1");
    expect(ing.reserved_stock).toBe(0);
  });

  it("adjust sets stock to target", async () => {
    const repo = makeRepo([baseIng()]);
    const svc = createInventoryService(repo);
    await svc.adjustStock({ ingredientId: "i1", quantity: 0, targetStock: 25 });
    const [ing] = await repo.listIngredients("r1");
    expect(ing.stock).toBe(25);
  });

  it("transfer decreases source stock", async () => {
    const repo = makeRepo([baseIng()]);
    const svc = createInventoryService(repo);
    await svc.transferStock({ ingredientId: "i1", quantity: 2, toLocationId: "L2" });
    const [ing] = await repo.listIngredients("r1");
    expect(ing.stock).toBe(8);
    expect(repo.movements[0].movement_type).toBe("TRANSFER");
  });

  it("emits StockLow and StockOut events", async () => {
    const repo = makeRepo([baseIng({ stock: 3 })]);
    const svc = createInventoryService(repo);
    const seen: string[] = [];
    InventoryEventBus.on("StockLow", () => seen.push("low"));
    InventoryEventBus.on("StockOut", () => seen.push("out"));
    await svc.decreaseStock({ ingredientId: "i1", quantity: 2 }); // -> 1 (<= min 2) => low
    await svc.decreaseStock({ ingredientId: "i1", quantity: 1 }); // -> 0 => out
    expect(seen).toContain("low");
    expect(seen).toContain("out");
  });

  it("writes audit entries", async () => {
    const repo = makeRepo([baseIng()]);
    const svc = createInventoryService(repo);
    await svc.increaseStock({ ingredientId: "i1", quantity: 1, performedBy: "u1", referenceType: "manual" });
    expect(InventoryAudit.list()).toHaveLength(1);
    expect(InventoryAudit.list()[0].who).toBe("u1");
  });
});

describe("StockAlerts", () => {
  it("classifies out/low/reorder", () => {
    const alerts = evaluateAlerts([
      baseIng({ id: "a", stock: 0 }),
      baseIng({ id: "b", stock: 0.5, min_stock: 2 }),
      baseIng({ id: "c", stock: 2, min_stock: 2 }),
      baseIng({ id: "d", stock: 10, min_stock: 2 }),
    ]);
    expect(alerts.find((x) => x.ingredientId === "a")?.level).toBe("OUT");
    expect(alerts.find((x) => x.ingredientId === "b")?.level).toBe("LOW");
    expect(alerts.find((x) => x.ingredientId === "c")?.level).toBe("REORDER");
    expect(alerts.find((x) => x.ingredientId === "d")).toBeUndefined();
  });
});

describe("CostEngine + MarginEngine", () => {
  it("computes recipe cost", () => {
    const ings = [baseIng({ id: "i1", unit_cost: 10 }), baseIng({ id: "i2", unit_cost: 5 })];
    const cost = CostEngine.recipeCost([{ ingredient_id: "i1", quantity: 2 }, { ingredient_id: "i2", quantity: 3 }], ings);
    expect(cost).toBe(35);
  });
  it("computes margin and suggests price", () => {
    const m = MarginEngine.compute(20, 50);
    expect(m.profit).toBe(30);
    expect(Math.round(m.marginPct)).toBe(60);
    expect(Math.round(MarginEngine.suggestPrice(20, 50))).toBe(40);
  });
});

describe("PurchaseOrderService", () => {
  it("creates draft and receives increases stock", async () => {
    const invRepo = makeRepo([baseIng()]);
    const inv = createInventoryService(invRepo);
    const poStore = new Map<string, { po: PurchaseOrder; items: PurchaseOrderItem[] }>();
    const poRepo: PurchaseOrderRepository = {
      async create(po, items) {
        const id = "po1"; const full: PurchaseOrder = { ...po, id };
        poStore.set(id, {
          po: full,
          items: items.map((it, idx) => ({ ...it, id: String(idx), purchase_order_id: id, total: it.quantity * it.unit_price })),
        });
        return full;
      },
      async updateStatus(id, status) {
        const e = poStore.get(id)!; e.po.status = status; return e.po;
      },
      async getItems(id) { return poStore.get(id)!.items; },
    };
    const svc = createPurchaseOrderService(poRepo, inv);
    const po = await svc.createDraft({
      supplier_id: "s1", restaurant_id: "r1", expected_date: null, notes: null,
      items: [{ ingredient_id: "i1", quantity: 4, unit_price: 30 }],
    });
    expect(po.total_cost).toBe(120);
    await svc.receive(po.id);
    const [ing] = await invRepo.listIngredients("r1");
    expect(ing.stock).toBe(14);
    expect(poStore.get(po.id)!.po.status).toBe("RECEIVED");
  });
});

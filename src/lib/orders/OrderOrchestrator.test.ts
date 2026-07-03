import { describe, it, expect, beforeEach, vi } from "vitest";
import { createOrchestrator, type OrchestratorDeps, type OrderSnapshot } from "./OrderOrchestrator";
import { OrderEventBus } from "./domain-events";
import { TransitionValidator } from "./TransitionValidator";
import { canTransition, isTerminal } from "./OrderStateMachine";
import { OrderTimelineService } from "./OrderTimelineService";
import { canActorPerform } from "./OrderPermissions";

function makeDeps(order: OrderSnapshot | null): OrchestratorDeps & {
  history: any[];
  updated: any[];
  published: any[];
} {
  const history: any[] = [];
  const updated: any[] = [];
  const published: any[] = [];
  return {
    history,
    updated,
    published,
    getOrder: vi.fn(async () => order),
    updateOrderStatus: vi.fn(async (id, s) => {
      updated.push({ id, s });
      if (order) order.status = s;
    }),
    insertHistory: vi.fn(async (row) => {
      history.push(row);
    }),
    publish: vi.fn(async (name, payload) => {
      published.push({ name, payload });
    }),
  };
}

const audit = { actorType: "system" as const, userId: "u1", service: "test" };

describe("OrderStateMachine", () => {
  it("permite transições canônicas do fluxo feliz", () => {
    expect(canTransition("CREATED", "WAITING_PAYMENT")).toBe(true);
    expect(canTransition("WAITING_PAYMENT", "PAYMENT_APPROVED")).toBe(true);
    expect(canTransition("PAYMENT_APPROVED", "RESTAURANT_ACCEPTED")).toBe(true);
    expect(canTransition("RESTAURANT_ACCEPTED", "PREPARING")).toBe(true);
    expect(canTransition("PREPARING", "READY")).toBe(true);
    expect(canTransition("READY", "OUT_FOR_DELIVERY")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "DELIVERED")).toBe(true);
    expect(canTransition("DELIVERED", "COMPLETED")).toBe(true);
  });

  it("bloqueia transições inválidas", () => {
    expect(canTransition("DELIVERED", "PREPARING")).toBe(false);
    expect(canTransition("CANCELLED", "READY")).toBe(false);
    expect(canTransition("PAYMENT_FAILED", "DELIVERED")).toBe(false);
    expect(canTransition("COMPLETED", "PREPARING")).toBe(false);
  });

  it("marca terminais corretamente", () => {
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("REFUNDED")).toBe(true);
    expect(isTerminal("PREPARING")).toBe(false);
  });
});

describe("TransitionValidator", () => {
  it("rejeita mesmo estado", () => {
    expect(
      TransitionValidator.validate({ from: "PREPARING", to: "PREPARING", actorType: "restaurant" }).reason,
    ).toBe("SAME_STATE");
  });
  it("rejeita transição inválida", () => {
    expect(
      TransitionValidator.validate({ from: "CREATED", to: "DELIVERED", actorType: "system" }).reason,
    ).toBe("INVALID_TRANSITION");
  });
  it("rejeita ator sem permissão", () => {
    expect(
      TransitionValidator.validate({ from: "PREPARING", to: "READY", actorType: "customer" }).reason,
    ).toBe("FORBIDDEN_ACTOR");
  });
  it("aceita transição válida com ator permitido", () => {
    expect(
      TransitionValidator.validate({ from: "PREPARING", to: "READY", actorType: "restaurant" }).ok,
    ).toBe(true);
  });
});

describe("OrderPermissions", () => {
  it("cliente não pode aprovar pagamento", () => {
    expect(canActorPerform("customer", "PAYMENT_APPROVED")).toBe(false);
  });
  it("webhook pode aprovar pagamento", () => {
    expect(canActorPerform("webhook", "PAYMENT_APPROVED")).toBe(true);
  });
  it("restaurante pode marcar pronto", () => {
    expect(canActorPerform("restaurant", "READY")).toBe(true);
  });
});

describe("OrderOrchestrator.transition", () => {
  beforeEach(() => OrderEventBus._reset());

  it("aplica transição válida, grava histórico e publica evento", async () => {
    const deps = makeDeps({ id: "o1", restaurant_id: "r1", status: "CREATED" });
    const orch = createOrchestrator(deps);
    const res = await orch.transition({ orderId: "o1", to: "WAITING_PAYMENT", audit });
    expect(res.ok).toBe(true);
    expect(deps.updated).toEqual([{ id: "o1", s: "WAITING_PAYMENT" }]);
    expect(deps.history[0].previous_status).toBe("CREATED");
    expect(deps.history[0].current_status).toBe("WAITING_PAYMENT");
    expect(deps.published[0].name).toBe("OrderWaitingPayment");
    expect(deps.published[0].payload.metadata.audit.actor_type).toBe("system");
  });

  it("bloqueia transição inválida sem tocar em nada", async () => {
    const deps = makeDeps({ id: "o1", restaurant_id: "r1", status: "DELIVERED" });
    const orch = createOrchestrator(deps);
    const res = await orch.transition({ orderId: "o1", to: "PREPARING", audit });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("INVALID_TRANSITION");
    expect(deps.updated).toHaveLength(0);
    expect(deps.history).toHaveLength(0);
    expect(deps.published).toHaveLength(0);
  });

  it("bloqueia ator sem permissão", async () => {
    const deps = makeDeps({ id: "o1", restaurant_id: "r1", status: "PREPARING" });
    const orch = createOrchestrator(deps);
    const res = await orch.transition({
      orderId: "o1",
      to: "READY",
      audit: { actorType: "customer" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("FORBIDDEN_ACTOR");
  });

  it("retorna ORDER_NOT_FOUND", async () => {
    const deps = makeDeps(null);
    const orch = createOrchestrator(deps);
    const res = await orch.transition({ orderId: "x", to: "WAITING_PAYMENT", audit });
    expect(res.reason).toBe("ORDER_NOT_FOUND");
  });

  it("EventBus recebe eventos externos quando publish default", async () => {
    const seen: string[] = [];
    OrderEventBus.subscribe((n) => { seen.push(n); });
    const order: OrderSnapshot = { id: "o1", restaurant_id: "r1", status: "CREATED" };
    const orch = createOrchestrator({
      getOrder: async () => order,
      updateOrderStatus: async (_i, s) => { order.status = s; },
      insertHistory: async () => {},
    });
    await orch.transition({ orderId: "o1", to: "WAITING_PAYMENT", audit });
    expect(seen).toContain("OrderWaitingPayment");
  });
});

describe("OrderTimelineService", () => {
  it("ordena por data e traduz labels", () => {
    const rows = [
      { id: "a", order_id: "o1", previous_status: "CREATED", current_status: "WAITING_PAYMENT", reason: null, performed_by: null, performed_by_type: "system", metadata: {}, created_at: "2025-01-01T11:33:00Z" },
      { id: "b", order_id: "o1", previous_status: null, current_status: "CREATED", reason: null, performed_by: null, performed_by_type: "system", metadata: {}, created_at: "2025-01-01T11:32:00Z" },
    ] as any;
    const tl = OrderTimelineService.build(rows);
    expect(tl[0].label).toBe("Pedido criado");
    expect(tl[1].label).toBe("Aguardando pagamento");
  });
});

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
    expect(canTransition("novo", "aguardando_pagamento")).toBe(true);
    expect(canTransition("aguardando_pagamento", "pago")).toBe(true);
    expect(canTransition("pago", "aceito")).toBe(true);
    expect(canTransition("aceito", "em_preparo")).toBe(true);
    expect(canTransition("em_preparo", "pronto")).toBe(true);
    expect(canTransition("pronto", "saiu_para_entrega")).toBe(true);
    expect(canTransition("saiu_para_entrega", "entregue")).toBe(true);
    expect(canTransition("entregue", "concluido")).toBe(true);
  });

  it("bloqueia transições inválidas", () => {
    expect(canTransition("entregue", "em_preparo")).toBe(false);
    expect(canTransition("cancelado", "pronto")).toBe(false);
    expect(canTransition("falha_pagamento", "entregue")).toBe(false);
    expect(canTransition("concluido", "em_preparo")).toBe(false);
  });

  it("marca terminais corretamente", () => {
    expect(isTerminal("cancelado")).toBe(true);
    expect(isTerminal("reembolsado")).toBe(true);
    expect(isTerminal("em_preparo")).toBe(false);
  });
});

describe("TransitionValidator", () => {
  it("rejeita mesmo estado", () => {
    expect(
      TransitionValidator.validate({ from: "em_preparo", to: "em_preparo", actorType: "restaurant" }).reason,
    ).toBe("SAME_STATE");
  });
  it("rejeita transição inválida", () => {
    expect(
      TransitionValidator.validate({ from: "novo", to: "entregue", actorType: "system" }).reason,
    ).toBe("INVALID_TRANSITION");
  });
  it("rejeita ator sem permissão", () => {
    expect(
      TransitionValidator.validate({ from: "em_preparo", to: "pronto", actorType: "customer" }).reason,
    ).toBe("FORBIDDEN_ACTOR");
  });
  it("aceita transição válida com ator permitido", () => {
    expect(
      TransitionValidator.validate({ from: "em_preparo", to: "pronto", actorType: "restaurant" }).ok,
    ).toBe(true);
  });
});

describe("OrderPermissions", () => {
  it("cliente não pode aprovar pagamento", () => {
    expect(canActorPerform("customer", "pago")).toBe(false);
  });
  it("webhook pode aprovar pagamento", () => {
    expect(canActorPerform("webhook", "pago")).toBe(true);
  });
  it("restaurante pode marcar pronto", () => {
    expect(canActorPerform("restaurant", "pronto")).toBe(true);
  });
});

describe("OrderOrchestrator.transition", () => {
  beforeEach(() => OrderEventBus._reset());

  it("aplica transição válida, grava histórico e publica evento", async () => {
    const deps = makeDeps({ id: "o1", restaurant_id: "r1", status: "novo" });
    const orch = createOrchestrator(deps);
    const res = await orch.transition({ orderId: "o1", to: "aguardando_pagamento", audit });
    expect(res.ok).toBe(true);
    expect(deps.updated).toEqual([{ id: "o1", s: "aguardando_pagamento" }]);
    expect(deps.history[0].previous_status).toBe("novo");
    expect(deps.history[0].current_status).toBe("aguardando_pagamento");
    expect(deps.published[0].name).toBe("OrderWaitingPayment");
    expect(deps.published[0].payload.metadata.audit.actor_type).toBe("system");
  });

  it("bloqueia transição inválida sem tocar em nada", async () => {
    const deps = makeDeps({ id: "o1", restaurant_id: "r1", status: "entregue" });
    const orch = createOrchestrator(deps);
    const res = await orch.transition({ orderId: "o1", to: "em_preparo", audit });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("INVALID_TRANSITION");
    expect(deps.updated).toHaveLength(0);
    expect(deps.history).toHaveLength(0);
    expect(deps.published).toHaveLength(0);
  });

  it("bloqueia ator sem permissão", async () => {
    const deps = makeDeps({ id: "o1", restaurant_id: "r1", status: "em_preparo" });
    const orch = createOrchestrator(deps);
    const res = await orch.transition({
      orderId: "o1",
      to: "pronto",
      audit: { actorType: "customer" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("FORBIDDEN_ACTOR");
  });

  it("retorna ORDER_NOT_FOUND", async () => {
    const deps = makeDeps(null);
    const orch = createOrchestrator(deps);
    const res = await orch.transition({ orderId: "x", to: "aguardando_pagamento", audit });
    expect(res.reason).toBe("ORDER_NOT_FOUND");
  });

  it("EventBus recebe eventos externos quando publish default", async () => {
    const seen: string[] = [];
    OrderEventBus.subscribe((n) => { seen.push(n); });
    const order: OrderSnapshot = { id: "o1", restaurant_id: "r1", status: "novo" };
    const orch = createOrchestrator({
      getOrder: async () => order,
      updateOrderStatus: async (_i, s) => { order.status = s; },
      insertHistory: async () => {},
    });
    await orch.transition({ orderId: "o1", to: "aguardando_pagamento", audit });
    expect(seen).toContain("OrderWaitingPayment");
  });
});

describe("OrderTimelineService", () => {
  it("ordena por data e traduz labels", () => {
    const rows = [
      { id: "a", order_id: "o1", previous_status: "novo", current_status: "aguardando_pagamento", reason: null, performed_by: null, performed_by_type: "system", metadata: {}, created_at: "2025-01-01T11:33:00Z" },
      { id: "b", order_id: "o1", previous_status: null, current_status: "novo", reason: null, performed_by: null, performed_by_type: "system", metadata: {}, created_at: "2025-01-01T11:32:00Z" },
    ] as any;
    const tl = OrderTimelineService.build(rows);
    expect(tl[0].label).toBe("Pedido criado");
    expect(tl[1].label).toBe("Aguardando pagamento");
  });
});

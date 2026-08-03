import { describe, expect, it } from "vitest";
import {
  createAutoAssignmentService,
  type AutoAssignState,
} from "./AutoAssignmentService";

function baseState(): AutoAssignState {
  return {
    orders: [
      { id: "o1", restaurantId: "r1", status: "pronto" },
      { id: "o2", restaurantId: "r1", status: "pronto" },
      { id: "o3", restaurantId: "r2", status: "pronto" },
    ],
    drivers: [
      { id: "d1", restaurantId: "r1", active: true, online: true },
      { id: "d2", restaurantId: "r1", active: true, online: true },
      { id: "d3", restaurantId: "r2", active: true, online: true },
      { id: "paused", restaurantId: "r1", active: true, online: true, paused: true },
    ],
    queue: [
      { driverId: "d1", restaurantId: "r1", position: 1, status: "AGUARDANDO" },
      { driverId: "d2", restaurantId: "r1", position: 2, status: "AGUARDANDO" },
      { driverId: "d3", restaurantId: "r2", position: 1, status: "AGUARDANDO" },
    ],
    assignments: [],
  };
}

describe("AutoAssignmentService", () => {
  it("atribui um pedido ao motoboy disponivel", () => {
    const state = baseState();
    const svc = createAutoAssignmentService(state);
    const result = svc.assign("o1");

    expect(result.reason).toBe("ASSIGNED");
    expect(result.assignment?.driverId).toBe("d1");
    expect(state.queue.find((q) => q.driverId === "d1")?.status).toBe("EM_ENTREGA");
  });

  it("com dois motoboys, o primeiro da fila recebe", () => {
    const state = baseState();
    const svc = createAutoAssignmentService(state);

    expect(svc.assign("o1").assignment?.driverId).toBe("d1");
    expect(state.queue.find((q) => q.driverId === "d2")?.position).toBe(1);
  });

  it("dois pedidos simultaneos usam dois motoboys diferentes", async () => {
    const state = baseState();
    const svc = createAutoAssignmentService(state);
    const [a, b] = await Promise.all([svc.assign("o1"), svc.assign("o2")]);

    expect(new Set([a.assignment?.driverId, b.assignment?.driverId])).toEqual(new Set(["d1", "d2"]));
  });

  it("corrida simultanea nao duplica atribuicao do mesmo pedido", async () => {
    const state = baseState();
    const svc = createAutoAssignmentService(state);
    const [a, b] = await Promise.all([svc.assign("o1"), svc.assign("o1")]);

    expect(a.assignment?.id).toBe(b.assignment?.id);
    expect(state.assignments).toHaveLength(1);
  });

  it("sem motoboy disponivel mantem pedido aguardando entregador", () => {
    const state = baseState();
    state.queue = [];
    const result = createAutoAssignmentService(state).assign("o1");

    expect(result).toMatchObject({ ok: false, reason: "NO_DRIVER_AVAILABLE" });
    expect(state.orders.find((o) => o.id === "o1")?.status).toBe("pronto");
  });

  it("motoboy disponivel depois recebe pedido pendente", () => {
    const state = baseState();
    state.queue = [];
    const svc = createAutoAssignmentService(state);
    expect(svc.assign("o1").reason).toBe("NO_DRIVER_AVAILABLE");

    state.queue.push({ driverId: "d1", restaurantId: "r1", position: 1, status: "AGUARDANDO" });
    expect(svc.assignPendingForRestaurant("r1").assignment?.driverId).toBe("d1");
  });

  it("pedido ja atribuido nao e atribuido novamente", () => {
    const state = baseState();
    const svc = createAutoAssignmentService(state);
    const first = svc.assign("o1");
    const repeated = svc.assign("o1");

    expect(repeated.reason).toBe("ALREADY_ASSIGNED");
    expect(repeated.assignment?.id).toBe(first.assignment?.id);
    expect(state.assignments).toHaveLength(1);
  });

  it("motoboy em pausa nao recebe", () => {
    const state = baseState();
    state.queue = [{ driverId: "paused", restaurantId: "r1", position: 1, status: "AGUARDANDO" }];

    expect(createAutoAssignmentService(state).assign("o1").reason).toBe("NO_DRIVER_AVAILABLE");
  });

  it("restaurante A nao usa motoboy do restaurante B", () => {
    const state = baseState();
    state.queue = [{ driverId: "d3", restaurantId: "r2", position: 1, status: "AGUARDANDO" }];

    expect(createAutoAssignmentService(state).assign("o1").reason).toBe("NO_DRIVER_AVAILABLE");
  });

  it("redistribuicao administrativa troca para motoboy escolhido da fila", () => {
    const state = baseState();
    const svc = createAutoAssignmentService(state);
    svc.assign("o1");
    const result = svc.assign("o1", "d2");

    expect(result.assignment?.driverId).toBe("d2");
    expect(state.assignments).toHaveLength(1);
    expect(state.queue.find((q) => q.driverId === "d1" && q.status === "AGUARDANDO")?.position).toBe(1);
  });

  it("motoboy conclui entrega e entra em retornando", () => {
    const state = baseState();
    const svc = createAutoAssignmentService(state);
    const assignment = svc.assign("o1").assignment!;

    svc.completeDelivery(assignment.id);

    expect(state.assignments[0].status).toBe("ENTREGUE");
    expect(state.drivers.find((d) => d.id === "d1")?.returning).toBe(true);
    expect(state.queue.find((q) => q.driverId === "d1")?.status).toBe("RETORNANDO");
  });

  it("retorno concluido volta ao fim da fila", () => {
    const state = baseState();
    const svc = createAutoAssignmentService(state);
    const assignment = svc.assign("o1").assignment!;
    svc.completeDelivery(assignment.id);
    svc.finishReturn("r1", "d1");

    expect(state.queue.find((q) => q.driverId === "d1" && q.status === "AGUARDANDO")?.position).toBe(2);
  });
});

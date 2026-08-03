import { describe, expect, it } from "vitest";
import { createQueueService, type QueueEntry, type QueueRpc } from "./QueueService";

type DriverState = {
  restaurant_id: string;
  status?: "ativo" | "inativo" | "afastado";
  online?: boolean;
  paused?: boolean;
  activeAssignment?: boolean;
  returning?: boolean;
};

function makeInMemoryRpc(drivers: Record<string, DriverState> = {}): QueueRpc {
  const state: QueueEntry[] = [];
  let seq = 0;
  const nextPos = (rid: string) =>
    (state.filter((e) => e.restaurant_id === rid && e.status === "AGUARDANDO")
      .reduce((m, e) => Math.max(m, e.position), 0)) + 1;

  const assertCanWait = (rid: string, did: string) => {
    const d = drivers[did] ?? { restaurant_id: rid, status: "ativo", online: true };
    if (d.restaurant_id !== rid) throw new Error("DRIVER_NOT_IN_RESTAURANT");
    if ((d.status ?? "ativo") !== "ativo") throw new Error("DRIVER_INACTIVE");
    if (d.online === false) throw new Error("DRIVER_OFFLINE");
    if (d.paused || d.activeAssignment || d.returning) throw new Error("DRIVER_UNAVAILABLE");
  };

  const reindexAfter = (rid: string, pos: number) => {
    state
      .filter((x) => x.restaurant_id === rid && x.status === "AGUARDANDO" && x.position > pos)
      .forEach((x) => (x.position -= 1));
  };

  return {
    async enqueue(rid, did) {
      const existing = state.find(
        (e) => e.restaurant_id === rid && e.driver_id === did && e.status !== "INATIVO",
      );
      if (existing) return existing.id;
      assertCanWait(rid, did);
      const entry: QueueEntry = {
        id: `q_${++seq}`,
        restaurant_id: rid,
        driver_id: did,
        position: nextPos(rid),
        status: "AGUARDANDO",
        entered_at: new Date().toISOString(),
        left_at: null,
      };
      state.push(entry);
      return entry.id;
    },
    async dequeue(rid, did) {
      const e = state.find((x) => x.restaurant_id === rid && x.driver_id === did && x.status === "AGUARDANDO");
      if (!e) return false;
      const pos = e.position;
      e.status = "EM_ENTREGA";
      e.position = 0;
      e.left_at = new Date().toISOString();
      if (drivers[did]) drivers[did].activeAssignment = true;
      reindexAfter(rid, pos);
      return true;
    },
    async returnToQueue(rid, did) {
      const existingWaiting = state.find(
        (x) => x.restaurant_id === rid && x.driver_id === did && x.status === "AGUARDANDO",
      );
      if (existingWaiting) return existingWaiting.id;
      if (drivers[did]) {
        drivers[did].activeAssignment = false;
        drivers[did].returning = false;
      }
      assertCanWait(rid, did);
      state
        .filter((x) => x.restaurant_id === rid && x.driver_id === did && (x.status === "EM_ENTREGA" || x.status === "RETORNANDO"))
        .forEach((x) => {
          x.status = "INATIVO";
          x.left_at ??= new Date().toISOString();
        });
      const entry: QueueEntry = {
        id: `q_${++seq}`,
        restaurant_id: rid,
        driver_id: did,
        position: nextPos(rid),
        status: "AGUARDANDO",
        entered_at: new Date().toISOString(),
        left_at: null,
      };
      state.push(entry);
      return entry.id;
    },
    async remove(rid, did) {
      const e = state.find((x) => x.restaurant_id === rid && x.driver_id === did && x.status === "AGUARDANDO");
      if (!e) return false;
      const pos = e.position;
      e.status = "INATIVO";
      e.left_at = new Date().toISOString();
      reindexAfter(rid, pos);
      return true;
    },
    async nextDriver(rid) {
      const e = state
        .filter((x) => x.restaurant_id === rid && x.status === "AGUARDANDO")
        .sort((a, b) => a.position - b.position)[0];
      return e ? { queue_id: e.id, driver_id: e.driver_id, queue_position: e.position } : null;
    },
    async list(rid) {
      return state.filter((x) => x.restaurant_id === rid);
    },
  };
}

describe("QueueService (FIFO)", () => {
  const R = "rest_A";
  const R2 = "rest_B";

  const makeDrivers = (): Record<string, DriverState> => ({
    d1: { restaurant_id: R, online: true },
    d2: { restaurant_id: R, online: true },
    d3: { restaurant_id: R, online: true },
    d4: { restaurant_id: R2, online: true },
    offline: { restaurant_id: R, online: false },
    paused: { restaurant_id: R, online: true, paused: true },
  });

  it("primeiro motoboy entra e recebe posicao 1", async () => {
    const svc = createQueueService(makeInMemoryRpc(makeDrivers()));
    await svc.enqueue(R, "d1");
    expect(await svc.driverPosition(R, "d1")).toBe(1);
  });

  it("segundo motoboy entra e recebe posicao 2", async () => {
    const svc = createQueueService(makeInMemoryRpc(makeDrivers()));
    await svc.enqueue(R, "d1");
    await svc.enqueue(R, "d2");
    expect(await svc.driverPosition(R, "d2")).toBe(2);
  });

  it("primeiro sai e segundo vira posicao 1", async () => {
    const svc = createQueueService(makeInMemoryRpc(makeDrivers()));
    await svc.enqueue(R, "d1");
    await svc.enqueue(R, "d2");
    expect(await svc.remove(R, "d1")).toBe(true);
    expect(await svc.driverPosition(R, "d2")).toBe(1);
  });

  it("motoboy recebe entrega e sai da fila", async () => {
    const svc = createQueueService(makeInMemoryRpc(makeDrivers()));
    await svc.enqueue(R, "d1");
    await svc.enqueue(R, "d2");
    expect(await svc.dequeue(R, "d1")).toBe(true);
    expect(await svc.driverPosition(R, "d1")).toBeNull();
    expect(await svc.driverPosition(R, "d2")).toBe(1);
  });

  it("retorno concluido recoloca motoboy no final", async () => {
    const drivers = makeDrivers();
    const svc = createQueueService(makeInMemoryRpc(drivers));
    await svc.enqueue(R, "d1");
    await svc.enqueue(R, "d2");
    await svc.dequeue(R, "d1");
    await svc.reenter(R, "d1");
    expect(await svc.driverPosition(R, "d2")).toBe(1);
    expect(await svc.driverPosition(R, "d1")).toBe(2);
  });

  it("duas chamadas simultaneas nao criam posicoes duplicadas", async () => {
    const svc = createQueueService(makeInMemoryRpc(makeDrivers()));
    const [a, b] = await Promise.all([svc.enqueue(R, "d1"), svc.enqueue(R, "d1")]);
    expect(a).toBe(b);
    expect(await svc.queueLength(R)).toBe(1);
    expect(await svc.driverPosition(R, "d1")).toBe(1);
  });

  it("motoboy de outro restaurante nao interfere na fila", async () => {
    const svc = createQueueService(makeInMemoryRpc(makeDrivers()));
    await svc.enqueue(R, "d1");
    await svc.enqueue(R2, "d4");
    expect(await svc.driverPosition(R, "d1")).toBe(1);
    expect(await svc.driverPosition(R2, "d4")).toBe(1);
    await expect(svc.enqueue(R2, "d1")).rejects.toThrow("DRIVER_NOT_IN_RESTAURANT");
  });

  it("motoboy offline nao entra", async () => {
    const svc = createQueueService(makeInMemoryRpc(makeDrivers()));
    await expect(svc.enqueue(R, "offline")).rejects.toThrow("DRIVER_OFFLINE");
    expect(await svc.queueLength(R)).toBe(0);
  });

  it("motoboy em pausa sai da fila", async () => {
    const drivers = makeDrivers();
    const svc = createQueueService(makeInMemoryRpc(drivers));
    await svc.enqueue(R, "d1");
    drivers.d1.paused = true;
    expect(await svc.remove(R, "d1")).toBe(true);
    await expect(svc.enqueue(R, "d1")).rejects.toThrow("DRIVER_UNAVAILABLE");
    expect(await svc.queueLength(R)).toBe(0);
  });

  it("requisicao repetida e idempotente", async () => {
    const svc = createQueueService(makeInMemoryRpc(makeDrivers()));
    const a = await svc.enqueue(R, "d1");
    const b = await svc.enqueue(R, "d1");
    expect(a).toBe(b);
    expect(await svc.queueLength(R)).toBe(1);
  });
});

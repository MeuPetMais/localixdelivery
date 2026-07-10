import { describe, expect, it } from "vitest";
import { createQueueService, type QueueEntry, type QueueRpc } from "./QueueService";

function makeInMemoryRpc(): QueueRpc {
  const state: QueueEntry[] = [];
  let seq = 0;
  const nextPos = (rid: string) =>
    (state.filter((e) => e.restaurant_id === rid && e.status === "AGUARDANDO")
      .reduce((m, e) => Math.max(m, e.position), 0)) + 1;

  return {
    async enqueue(rid, did) {
      const existing = state.find(
        (e) => e.restaurant_id === rid && e.driver_id === did && e.status !== "INATIVO",
      );
      if (existing) return existing.id;
      const entry: QueueEntry = {
        id: `q_${++seq}`, restaurant_id: rid, driver_id: did,
        position: nextPos(rid), status: "AGUARDANDO",
        entered_at: new Date().toISOString(), left_at: null,
      };
      state.push(entry);
      return entry.id;
    },
    async dequeue(rid, did) {
      const e = state.find((x) => x.restaurant_id === rid && x.driver_id === did && x.status === "AGUARDANDO");
      if (!e) return false;
      const pos = e.position;
      e.status = "EM_ENTREGA"; e.left_at = new Date().toISOString();
      state
        .filter((x) => x.restaurant_id === rid && x.status === "AGUARDANDO" && x.position > pos)
        .forEach((x) => (x.position -= 1));
      return true;
    },
    async returnToQueue(rid, did) {
      state
        .filter((x) => x.restaurant_id === rid && x.driver_id === did && (x.status === "EM_ENTREGA" || x.status === "RETORNANDO"))
        .forEach((x) => { x.status = "INATIVO"; x.left_at ??= new Date().toISOString(); });
      const entry: QueueEntry = {
        id: `q_${++seq}`, restaurant_id: rid, driver_id: did,
        position: nextPos(rid), status: "AGUARDANDO",
        entered_at: new Date().toISOString(), left_at: null,
      };
      state.push(entry);
      return entry.id;
    },
    async remove(rid, did) {
      const e = state.find((x) => x.restaurant_id === rid && x.driver_id === did && x.status === "AGUARDANDO");
      if (!e) return false;
      const pos = e.position;
      e.status = "INATIVO"; e.left_at = new Date().toISOString();
      state
        .filter((x) => x.restaurant_id === rid && x.status === "AGUARDANDO" && x.position > pos)
        .forEach((x) => (x.position -= 1));
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

  it("enqueue coloca motoboys em ordem FIFO", async () => {
    const svc = createQueueService(makeInMemoryRpc());
    await svc.enqueue(R, "d1");
    await svc.enqueue(R, "d2");
    await svc.enqueue(R, "d3");
    expect(await svc.queueLength(R)).toBe(3);
    const next = await svc.nextDriver(R);
    expect(next?.driver_id).toBe("d1");
    expect(next?.queue_position).toBe(1);
  });

  it("enqueue duplicado é idempotente", async () => {
    const svc = createQueueService(makeInMemoryRpc());
    const a = await svc.enqueue(R, "d1");
    const b = await svc.enqueue(R, "d1");
    expect(a).toBe(b);
    expect(await svc.queueLength(R)).toBe(1);
  });

  it("dequeue remove o primeiro e reindexa posições", async () => {
    const svc = createQueueService(makeInMemoryRpc());
    await svc.enqueue(R, "d1");
    await svc.enqueue(R, "d2");
    await svc.enqueue(R, "d3");
    expect(await svc.dequeue(R, "d1")).toBe(true);
    expect(await svc.queueLength(R)).toBe(2);
    expect(await svc.driverPosition(R, "d2")).toBe(1);
    expect(await svc.driverPosition(R, "d3")).toBe(2);
  });

  it("return recoloca o motoboy no final da fila", async () => {
    const svc = createQueueService(makeInMemoryRpc());
    await svc.enqueue(R, "d1");
    await svc.enqueue(R, "d2");
    await svc.dequeue(R, "d1"); // sai para entrega
    await svc.reenter(R, "d1"); // volta
    expect(await svc.driverPosition(R, "d2")).toBe(1);
    expect(await svc.driverPosition(R, "d1")).toBe(2);
  });

  it("filas de restaurantes distintos são isoladas", async () => {
    const svc = createQueueService(makeInMemoryRpc());
    await svc.enqueue(R, "d1");
    await svc.enqueue(R2, "d1");
    expect(await svc.queueLength(R)).toBe(1);
    expect(await svc.queueLength(R2)).toBe(1);
  });

  it("remove tira o motoboy da fila sem passar por entrega", async () => {
    const svc = createQueueService(makeInMemoryRpc());
    await svc.enqueue(R, "d1");
    await svc.enqueue(R, "d2");
    expect(await svc.remove(R, "d1")).toBe(true);
    expect(await svc.driverPosition(R, "d2")).toBe(1);
  });
});

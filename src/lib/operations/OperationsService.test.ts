import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyPriority, withPriority } from "./PriorityEngine";
import { buildAlerts } from "./AlertsEngine";
import { computeCounters, computeMetrics } from "./OperationsMetrics";
import { applyFilters } from "./OperationsFilters";
import { canPerform, ACTION_TO_STATE } from "./OperationsPermissions";
import { columnForState } from "./columns";
import { createOperationsService } from "./OperationsService";
import { KitchenSounds } from "./KitchenSounds";
import { OperationsRealtime } from "./OperationsRealtime";
import { OrderEventBus } from "@/lib/orders/domain-events";
import type { OperationsOrderCard } from "./types";

const NOW = new Date("2026-07-03T12:00:00Z").getTime();

function card(overrides: Partial<OperationsOrderCard> = {}): OperationsOrderCard {
  return {
    id: overrides.id ?? "o1", number: "#001", customerName: "Ana",
    customerPhone: "11999", itemsSummary: "1x Pizza", itemsCount: 1,
    total: 50, paymentMethod: "PIX", paymentApproved: true,
    createdAt: new Date(NOW - 10 * 60000).toISOString(),
    status: "CREATED", deliveryMode: "DELIVERY", priority: "NORMAL",
    ...overrides,
  };
}

describe("Operations Center", () => {
  beforeEach(() => { OrderEventBus._reset(); KitchenSounds.disable(); });

  it("classifies priority by age/eta", () => {
    expect(classifyPriority({ createdAt: new Date(NOW - 2 * 60000).toISOString(), now: NOW })).toBe("LOW");
    expect(classifyPriority({ createdAt: new Date(NOW - 45 * 60000).toISOString(), now: NOW })).toBe("URGENT");
    expect(classifyPriority({ createdAt: new Date(NOW - 15 * 60000).toISOString(), etaMinutes: 30, now: NOW })).toBe("NORMAL");
  });

  it("applies priority to cards", () => {
    const [c] = withPriority([card({ createdAt: new Date(NOW - 40 * 60000).toISOString() })], NOW);
    expect(c.priority).toBe("URGENT");
  });

  it("builds alerts for late/payment/closed", () => {
    const alerts = buildAlerts([
      card({ id: "a", status: "WAITING_PAYMENT", paymentApproved: false, createdAt: new Date(NOW - 15 * 60000).toISOString() }),
      card({ id: "b", status: "PREPARING", createdAt: new Date(NOW - 40 * 60000).toISOString() }),
    ], { now: NOW, restaurantOpen: false });
    expect(alerts.find((a) => a.type === "RESTAURANT_CLOSED")).toBeTruthy();
    expect(alerts.find((a) => a.type === "PAYMENT_PENDING")).toBeTruthy();
    expect(alerts.find((a) => a.type === "LATE_ORDER")).toBeTruthy();
  });

  it("counts and metrics work", () => {
    const cards = [
      card({ id: "1", status: "CREATED" }),
      card({ id: "2", status: "PREPARING" }),
      card({ id: "3", status: "DELIVERED", createdAt: new Date(NOW - 10 * 60000).toISOString() }),
    ];
    const c = computeCounters(cards, NOW);
    expect(c.new).toBe(1); expect(c.preparing).toBe(1); expect(c.completedToday).toBe(1);
    const m = computeMetrics(cards, [], NOW);
    expect(m.cancellations).toBe(0);
  });

  it("filters by search/customer/priority", () => {
    const cards = withPriority([
      card({ id: "1", customerName: "Ana", createdAt: new Date(NOW - 40 * 60000).toISOString() }),
      card({ id: "2", customerName: "Bruno" }),
    ], NOW);
    expect(applyFilters(cards, { search: "ana" }, NOW)).toHaveLength(1);
    expect(applyFilters(cards, { priority: "URGENT" }, NOW)).toHaveLength(1);
  });

  it("permission matrix and columns", () => {
    expect(canPerform("KITCHEN", "START_PREP")).toBe(true);
    expect(canPerform("KITCHEN", "CANCEL")).toBe(false);
    expect(ACTION_TO_STATE.ACCEPT).toBe("RESTAURANT_ACCEPTED");
    expect(columnForState("READY")).toBe("READY");
    expect(columnForState("DELIVERED")).toBe("COMPLETED");
  });

  it("perform delegates to OrderOrchestrator and audits", async () => {
    const transition = vi.fn().mockResolvedValue({ ok: true });
    const audit = vi.fn();
    const svc = createOperationsService({ orchestrator: { transition }, audit });
    await svc.perform({ action: "ACCEPT", orderId: "o1", role: "ATTENDANT", actorId: "u1" });
    expect(transition).toHaveBeenCalledWith(expect.objectContaining({ orderId: "o1", to: "RESTAURANT_ACCEPTED" }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "ACCEPT", role: "ATTENDANT" }));
  });

  it("perform rejects unauthorized actions", async () => {
    const svc = createOperationsService({ orchestrator: { transition: vi.fn() } });
    await expect(svc.perform({ action: "CANCEL", orderId: "o1", role: "KITCHEN" })).rejects.toThrow();
  });

  it("buildBoard groups cards into columns", () => {
    const svc = createOperationsService({ orchestrator: { transition: vi.fn() } });
    const board = svc.buildBoard([
      card({ id: "1", status: "CREATED" }),
      card({ id: "2", status: "PREPARING" }),
    ], {}, NOW);
    expect(board.columns.find((c) => c.id === "NEW")?.cards).toHaveLength(1);
    expect(board.columns.find((c) => c.id === "PREPARING")?.cards).toHaveLength(1);
  });

  it("kitchen sounds emit only when enabled", () => {
    const spy = vi.fn();
    KitchenSounds.onPlay(spy);
    KitchenSounds.play("NEW_ORDER");
    expect(spy).not.toHaveBeenCalled();
    KitchenSounds.enable();
    KitchenSounds.play("NEW_ORDER");
    expect(spy).toHaveBeenCalledWith("NEW_ORDER", undefined);
  });

  it("realtime bridges OrderEventBus", async () => {
    const seen: unknown[] = [];
    const off = OperationsRealtime.subscribe((e) => seen.push(e));
    await OrderEventBus.publish("order.accepted", {
      orderId: "o9", restaurantId: "r1", previousState: "CREATED", currentState: "RESTAURANT_ACCEPTED",
      performedByType: "STAFF", performedBy: null, reason: null, metadata: {}, occurredAt: new Date().toISOString(),
    } as never);
    off();
    expect(seen).toHaveLength(1);
  });
});

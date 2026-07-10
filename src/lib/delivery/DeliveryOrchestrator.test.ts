import { describe, it, expect, vi } from "vitest";
import {
  createDeliveryOrchestrator,
  type AssignmentSnapshot,
} from "./DeliveryOrchestrator";
import { canTransition } from "./DeliveryAssignmentStateMachine";

function makeSnap(overrides: Partial<AssignmentSnapshot> = {}): AssignmentSnapshot {
  return {
    id: "a1",
    order_id: "o1",
    restaurant_id: "r1",
    driver_id: "d1",
    status: "PENDENTE",
    correlation_id: "c1",
    ...overrides,
  };
}

describe("DeliveryAssignment state machine", () => {
  it("permite transições válidas", () => {
    expect(canTransition("PENDENTE", "ATRIBUIDO")).toBe(true);
    expect(canTransition("ATRIBUIDO", "COLETANDO")).toBe(true);
    expect(canTransition("COLETANDO", "EM_ROTA")).toBe(true);
    expect(canTransition("EM_ROTA", "ENTREGUE")).toBe(true);
    expect(canTransition("ATRIBUIDO", "CANCELADO")).toBe(true);
  });

  it("bloqueia transições inválidas", () => {
    expect(canTransition("PENDENTE", "EM_ROTA")).toBe(false);
    expect(canTransition("ENTREGUE", "CANCELADO")).toBe(false);
    expect(canTransition("CANCELADO", "ATRIBUIDO")).toBe(false);
  });
});

describe("DeliveryOrchestrator", () => {
  it("aplica transição e publica evento", async () => {
    const snap = makeSnap({ status: "PENDENTE" });
    const publish = vi.fn().mockResolvedValue(undefined);
    const applyAtomic = vi.fn().mockResolvedValue({ ok: true });
    const onAssigned = vi.fn().mockResolvedValue(undefined);
    const orch = createDeliveryOrchestrator({
      getAssignment: async () => snap,
      applyAtomic,
      onAssigned,
      publish,
    });
    const res = await orch.transition({
      assignmentId: "a1",
      to: "ATRIBUIDO",
      audit: { actor: "restaurant", actorId: "u1", correlationId: "c1" },
    });
    expect(res.ok).toBe(true);
    expect(applyAtomic).toHaveBeenCalledOnce();
    expect(onAssigned).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith("DeliveryAssigned", expect.objectContaining({
      assignmentId: "a1", currentState: "ATRIBUIDO", previousState: "PENDENTE",
    }));
  });

  it("recusa transição inválida sem chamar applyAtomic", async () => {
    const applyAtomic = vi.fn();
    const orch = createDeliveryOrchestrator({
      getAssignment: async () => makeSnap({ status: "PENDENTE" }),
      applyAtomic,
    });
    const res = await orch.transition({
      assignmentId: "a1",
      to: "EM_ROTA",
      audit: { actor: "restaurant", actorId: "u1", correlationId: "c1" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("INVALID_TRANSITION");
    expect(applyAtomic).not.toHaveBeenCalled();
  });

  it("propaga falha de CAS (STATE_MISMATCH)", async () => {
    const orch = createDeliveryOrchestrator({
      getAssignment: async () => makeSnap({ status: "ATRIBUIDO" }),
      applyAtomic: async () => ({ ok: false, reason: "STATE_MISMATCH" }),
    });
    const res = await orch.transition({
      assignmentId: "a1",
      to: "COLETANDO",
      audit: { actor: "driver", actorId: "u2", correlationId: "c1" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("STATE_MISMATCH");
  });

  it("dispara onDelivered ao finalizar entrega", async () => {
    const onDelivered = vi.fn().mockResolvedValue(undefined);
    const orch = createDeliveryOrchestrator({
      getAssignment: async () => makeSnap({ status: "EM_ROTA" }),
      applyAtomic: async () => ({ ok: true }),
      onDelivered,
      publish: async () => {},
    });
    const res = await orch.transition({
      assignmentId: "a1",
      to: "ENTREGUE",
      audit: { actor: "driver", actorId: "u2", correlationId: "c1" },
    });
    expect(res.ok).toBe(true);
    expect(onDelivered).toHaveBeenCalledOnce();
  });
});

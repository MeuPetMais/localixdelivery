export type AutoAssignOrderStatus = "pronto" | "saiu_para_entrega" | "entregue" | string;
export type AutoAssignAssignmentStatus =
  | "ATRIBUIDO"
  | "COLETANDO"
  | "EM_ROTA"
  | "ENTREGUE"
  | "CANCELADO";
export type AutoAssignQueueStatus = "AGUARDANDO" | "EM_ENTREGA" | "RETORNANDO" | "INATIVO";

export interface AutoAssignOrder {
  id: string;
  restaurantId: string;
  status: AutoAssignOrderStatus;
}

export interface AutoAssignDriver {
  id: string;
  restaurantId: string;
  active: boolean;
  online: boolean;
  paused?: boolean;
  returning?: boolean;
}

export interface AutoAssignQueueEntry {
  driverId: string;
  restaurantId: string;
  position: number;
  status: AutoAssignQueueStatus;
}

export interface AutoAssignAssignment {
  id: string;
  orderId: string;
  restaurantId: string;
  driverId: string;
  status: AutoAssignAssignmentStatus;
  assignedAt: string;
  previousQueuePosition: number | null;
}

export interface AutoAssignState {
  orders: AutoAssignOrder[];
  drivers: AutoAssignDriver[];
  queue: AutoAssignQueueEntry[];
  assignments: AutoAssignAssignment[];
}

export interface AutoAssignResult {
  ok: boolean;
  reason: "ASSIGNED" | "ALREADY_ASSIGNED" | "ORDER_NOT_ELIGIBLE" | "NO_DRIVER_AVAILABLE" | "ORDER_NOT_FOUND";
  assignment?: AutoAssignAssignment;
}

const ACTIVE_ASSIGNMENTS: AutoAssignAssignmentStatus[] = ["ATRIBUIDO", "COLETANDO", "EM_ROTA"];

function isEligibleDriver(state: AutoAssignState, restaurantId: string, driverId: string): boolean {
  const driver = state.drivers.find((d) => d.id === driverId);
  if (!driver) return false;
  if (driver.restaurantId !== restaurantId) return false;
  if (!driver.active || !driver.online || driver.paused || driver.returning) return false;
  return !state.assignments.some(
    (a) => a.driverId === driverId && ACTIVE_ASSIGNMENTS.includes(a.status),
  );
}

function reindexQueue(state: AutoAssignState, restaurantId: string) {
  state.queue
    .filter((q) => q.restaurantId === restaurantId && q.status === "AGUARDANDO")
    .sort((a, b) => a.position - b.position)
    .forEach((q, index) => {
      q.position = index + 1;
    });
}

export function createAutoAssignmentService(state: AutoAssignState) {
  function assign(orderId: string, forcedDriverId?: string): AutoAssignResult {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, reason: "ORDER_NOT_FOUND" };
    if (order.status !== "pronto") return { ok: false, reason: "ORDER_NOT_ELIGIBLE" };

    const existing = state.assignments.find(
      (a) => a.orderId === orderId && ACTIVE_ASSIGNMENTS.includes(a.status),
    );
    if (existing && !forcedDriverId) {
      return { ok: true, reason: "ALREADY_ASSIGNED", assignment: existing };
    }

    const selected = state.queue
      .filter(
        (q) =>
          q.restaurantId === order.restaurantId &&
          q.status === "AGUARDANDO" &&
          (!forcedDriverId || q.driverId === forcedDriverId) &&
          isEligibleDriver(state, order.restaurantId, q.driverId),
      )
      .sort((a, b) => a.position - b.position)[0];

    if (!selected) return { ok: false, reason: "NO_DRIVER_AVAILABLE" };

    const previousQueuePosition = selected.position;
    selected.status = "EM_ENTREGA";
    selected.position = 0;
    reindexQueue(state, order.restaurantId);

    if (existing && forcedDriverId) {
      const previousDriverId = existing.driverId;
      existing.driverId = selected.driverId;
      existing.status = "ATRIBUIDO";
      existing.assignedAt = new Date().toISOString();
      existing.previousQueuePosition = previousQueuePosition;
      if (previousDriverId !== selected.driverId) {
        finishReturn(order.restaurantId, previousDriverId);
      }
      return { ok: true, reason: "ASSIGNED", assignment: existing };
    }

    const assignment: AutoAssignAssignment = {
      id: `a_${state.assignments.length + 1}`,
      orderId: order.id,
      restaurantId: order.restaurantId,
      driverId: selected.driverId,
      status: "ATRIBUIDO",
      assignedAt: new Date().toISOString(),
      previousQueuePosition,
    };
    state.assignments.push(assignment);
    return { ok: true, reason: "ASSIGNED", assignment };
  }

  function assignPendingForRestaurant(restaurantId: string): AutoAssignResult {
    const pending = state.orders
      .filter(
        (o) =>
          o.restaurantId === restaurantId &&
          o.status === "pronto" &&
          !state.assignments.some(
            (a) => a.orderId === o.id && ACTIVE_ASSIGNMENTS.includes(a.status),
          ),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const order of pending) {
      const result = assign(order.id);
      if (result.ok) return result;
    }
    return { ok: false, reason: "NO_DRIVER_AVAILABLE" };
  }

  function completeDelivery(assignmentId: string) {
    const assignment = state.assignments.find((a) => a.id === assignmentId);
    if (!assignment) return;
    assignment.status = "ENTREGUE";
    const driver = state.drivers.find((d) => d.id === assignment.driverId);
    if (driver) driver.returning = true;
    const queueRow = state.queue.find(
      (q) => q.restaurantId === assignment.restaurantId && q.driverId === assignment.driverId && q.status === "EM_ENTREGA",
    );
    if (queueRow) queueRow.status = "RETORNANDO";
  }

  function finishReturn(restaurantId: string, driverId: string) {
    const driver = state.drivers.find((d) => d.id === driverId);
    if (driver) driver.returning = false;
    state.queue
      .filter((q) => q.restaurantId === restaurantId && q.driverId === driverId && q.status !== "INATIVO")
      .forEach((q) => {
        q.status = "INATIVO";
        q.position = 0;
      });
    const nextPosition =
      Math.max(
        0,
        ...state.queue
          .filter((q) => q.restaurantId === restaurantId && q.status === "AGUARDANDO")
          .map((q) => q.position),
      ) + 1;
    state.queue.push({ restaurantId, driverId, position: nextPosition, status: "AGUARDANDO" });
  }

  return { assign, assignPendingForRestaurant, completeDelivery, finishReturn };
}

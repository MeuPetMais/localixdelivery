// RC5.2.a.2 — DeliveryOrchestrator
// Camada central de orquestração do Delivery Assignment. Toda mudança de estado
// obrigatoriamente passa por `transition()`. Módulo I/O-agnóstico: recebe
// dependências injetáveis para leitura/gravação/publicação, permitindo testes
// determinísticos sem tocar Supabase.

import {
  canTransition,
  type DeliveryAssignmentState,
} from "./DeliveryAssignmentStateMachine";
import {
  DeliveryAssignmentEventBus,
  STATE_TO_EVENT,
  type DeliveryAssignmentEventPayload,
} from "./DeliveryAssignmentEventBus";
import { buildDeliveryAuditMetadata, type DeliveryAuditContext } from "./DeliveryAudit";

export interface AssignmentSnapshot {
  id: string;
  order_id: string;
  restaurant_id: string;
  driver_id: string;
  status: DeliveryAssignmentState;
  correlation_id: string;
}

export interface OrchestratorDeps {
  getAssignment: (assignmentId: string) => Promise<AssignmentSnapshot | null>;
  applyAtomic: (input: {
    assignmentId: string;
    expectedFrom: DeliveryAssignmentState;
    nextStatus: DeliveryAssignmentState;
    actor: string;
    actorId: string | null;
    reason: string | null;
    correlationId: string;
    metadata: Record<string, unknown>;
  }) => Promise<{ ok: boolean; reason?: string; current?: string }>;
  onCollected?: (a: AssignmentSnapshot) => Promise<void>;
  onDelivered?: (a: AssignmentSnapshot) => Promise<void>;
  onAssigned?: (a: AssignmentSnapshot) => Promise<void>;
  onCancelled?: (a: AssignmentSnapshot) => Promise<void>;
  publish?: (
    name: (typeof STATE_TO_EVENT)[keyof typeof STATE_TO_EVENT],
    payload: DeliveryAssignmentEventPayload,
  ) => Promise<void>;
}

export interface TransitionInput {
  assignmentId: string;
  to: DeliveryAssignmentState;
  reason?: string;
  audit: DeliveryAuditContext;
  metadata?: Record<string, unknown>;
}

export interface TransitionResult {
  ok: boolean;
  from: DeliveryAssignmentState | null;
  to: DeliveryAssignmentState;
  reason?: string;
}

export function createDeliveryOrchestrator(deps: OrchestratorDeps) {
  const publish = deps.publish ?? DeliveryAssignmentEventBus.publish.bind(DeliveryAssignmentEventBus);

  async function transition(input: TransitionInput): Promise<TransitionResult> {
    const a = await deps.getAssignment(input.assignmentId);
    if (!a) return { ok: false, from: null, to: input.to, reason: "ASSIGNMENT_NOT_FOUND" };

    if (!canTransition(a.status, input.to)) {
      return { ok: false, from: a.status, to: input.to, reason: "INVALID_TRANSITION" };
    }

    const correlationId = input.audit.correlationId ?? a.correlation_id;
    const metadata = buildDeliveryAuditMetadata(
      { ...input.audit, correlationId },
      input.metadata ?? {},
    );

    const res = await deps.applyAtomic({
      assignmentId: a.id,
      expectedFrom: a.status,
      nextStatus: input.to,
      actor: input.audit.actor,
      actorId: input.audit.actorId,
      reason: input.reason ?? null,
      correlationId,
      metadata,
    });
    if (!res.ok) return { ok: false, from: a.status, to: input.to, reason: res.reason ?? "APPLY_FAILED" };

    const next: AssignmentSnapshot = { ...a, status: input.to, correlation_id: correlationId };

    if (input.to === "ATRIBUIDO" && deps.onAssigned) await deps.onAssigned(next);
    if (input.to === "COLETANDO" && deps.onCollected) await deps.onCollected(next);
    if (input.to === "ENTREGUE" && deps.onDelivered) await deps.onDelivered(next);
    if (input.to === "CANCELADO" && deps.onCancelled) await deps.onCancelled(next);

    const eventName = STATE_TO_EVENT[input.to];
    if (eventName) {
      await publish(eventName, {
        assignmentId: a.id,
        orderId: a.order_id,
        restaurantId: a.restaurant_id,
        driverId: a.driver_id,
        previousState: a.status,
        currentState: input.to,
        actor: input.audit.actor,
        actorId: input.audit.actorId,
        reason: input.reason ?? null,
        correlationId,
        metadata,
        occurredAt: input.audit.occurredAt ?? new Date().toISOString(),
      });
    }

    return { ok: true, from: a.status, to: input.to };
  }

  return { transition };
}

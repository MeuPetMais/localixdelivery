// OrderOrchestrator — camada central de orquestração do ciclo de vida do pedido.
// Toda alteração de estado obrigatoriamente passa por `transition()`.
//
// Este módulo é PURO em relação a I/O: recebe dependências (`OrchestratorDeps`)
// injetáveis para leitura/gravação/publish. Isso permite testes determinísticos
// sem tocar Supabase/EventBus e mantém integração com outros módulos opcional
// (não altera Webhook/Split/Ledger existentes).

import type { OrderState } from "./OrderStateMachine";
import { TransitionValidator } from "./TransitionValidator";
import type { OrderActorType } from "./OrderPermissions";
import {
  OrderEventBus,
  STATE_TO_EVENT,
  type OrderDomainEventPayload,
} from "./domain-events";
import { buildAuditMetadata, type OrderAuditContext } from "./OrderAudit";

export interface OrderSnapshot {
  id: string;
  restaurant_id: string | null;
  status: OrderState;
}

export interface StatusHistoryRow {
  id: string;
  order_id: string;
  previous_status: OrderState | null;
  current_status: OrderState;
  reason: string | null;
  performed_by: string | null;
  performed_by_type: OrderActorType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface OrchestratorDeps {
  getOrder: (orderId: string) => Promise<OrderSnapshot | null>;
  updateOrderStatus: (orderId: string, next: OrderState) => Promise<void>;
  insertHistory: (row: Omit<StatusHistoryRow, "id" | "created_at">) => Promise<void>;
  // RC4.2: opcional — quando presente, substitui updateOrderStatus + insertHistory
  // por uma operação atômica única (RPC + CAS). Preserva compatibilidade dos testes
  // e do path da UI que ainda usam a variante em dois passos.
  applyAtomic?: (
    row: Omit<StatusHistoryRow, "id" | "created_at"> & { next_status: OrderState; expected_from: OrderState },
  ) => Promise<void>;
  publish?: (
    name: ReturnType<() => (typeof STATE_TO_EVENT)[OrderState]>,
    payload: OrderDomainEventPayload,
  ) => Promise<void>;
}


export interface TransitionInput {
  orderId: string;
  to: OrderState;
  reason?: string;
  audit: OrderAuditContext;
  metadata?: Record<string, unknown>;
}

export interface TransitionResult {
  ok: boolean;
  from: OrderState | null;
  to: OrderState;
  reason?: string;
}

export function createOrchestrator(deps: OrchestratorDeps) {
  const publish = deps.publish ?? OrderEventBus.publish.bind(OrderEventBus);

  async function transition(input: TransitionInput): Promise<TransitionResult> {
    const order = await deps.getOrder(input.orderId);
    if (!order) {
      return { ok: false, from: null, to: input.to, reason: "ORDER_NOT_FOUND" };
    }

    const validation = TransitionValidator.validate({
      from: order.status,
      to: input.to,
      actorType: input.audit.actorType,
    });
    if (!validation.ok) {
      return {
        ok: false,
        from: order.status,
        to: input.to,
        reason: validation.reason,
      };
    }

    await deps.updateOrderStatus(order.id, input.to);

    const metadata = buildAuditMetadata(input.audit, input.metadata ?? {});
    await deps.insertHistory({
      order_id: order.id,
      previous_status: order.status,
      current_status: input.to,
      reason: input.reason ?? null,
      performed_by: input.audit.userId ?? null,
      performed_by_type: input.audit.actorType,
      metadata,
    });

    const eventName = STATE_TO_EVENT[input.to];
    await publish(eventName, {
      orderId: order.id,
      restaurantId: order.restaurant_id,
      previousStatus: order.status,
      currentStatus: input.to,
      actorType: input.audit.actorType,
      performedBy: input.audit.userId ?? null,
      reason: input.reason ?? null,
      metadata,
      occurredAt: input.audit.occurredAt ?? new Date().toISOString(),
    });

    return { ok: true, from: order.status, to: input.to };
  }

  return { transition };
}

// OperationsService — fachada única do Centro de Operações.
// Toda mudança de status usa OrderOrchestrator.transition(). Este service
// NUNCA altera pedidos diretamente. Componentes React consomem apenas este
// arquivo; providers de dados são injetáveis para preservar testes e evitar
// acoplamento com Supabase.

import type { OrderOrchestrator } from "@/lib/orders/OrderOrchestrator";
import { canPerform, ACTION_TO_STATE, type OperationsAction } from "./OperationsPermissions";
import { KitchenSounds } from "./KitchenSounds";
import type {
  OperationsFilters, OperationsOrderCard, OperationsRole,
} from "./types";
import { applyFilters } from "./OperationsFilters";
import { withPriority } from "./PriorityEngine";
import { buildAlerts } from "./AlertsEngine";
import { computeCounters, computeMetrics } from "./OperationsMetrics";
import { columnForState, OPERATIONS_COLUMNS } from "./columns";

export interface OperationsAuditRecord {
  action: OperationsAction;
  orderId: string;
  actorId?: string;
  role: OperationsRole;
  at: string;
  origin: "OPERATIONS_CENTER";
}

export interface OperationsDeps {
  orchestrator: Pick<typeof OrderOrchestrator, "transition"> | { transition: typeof OrderOrchestrator.transition };
  audit?: (record: OperationsAuditRecord) => Promise<void> | void;
}

export interface PerformInput {
  action: OperationsAction;
  orderId: string;
  role: OperationsRole;
  actorId?: string;
  reason?: string;
}

export function createOperationsService(deps: OperationsDeps) {
  return {
    async perform(input: PerformInput) {
      if (!canPerform(input.role, input.action)) {
        throw new Error(`Perfil ${input.role} não pode executar ${input.action}`);
      }
      const next = ACTION_TO_STATE[input.action];
      const result = await (deps.orchestrator as any).transition({
        orderId: input.orderId,
        to: next,
        reason: input.reason,
        actor: { type: "STAFF", id: input.actorId },
        origin: "operations_center",
      });
      await deps.audit?.({
        action: input.action, orderId: input.orderId, actorId: input.actorId,
        role: input.role, at: new Date().toISOString(), origin: "OPERATIONS_CENTER",
      });
      if (input.action === "FINISH_PREP") KitchenSounds.play("ORDER_READY", { orderId: input.orderId });
      if (input.action === "CANCEL" || input.action === "REJECT") KitchenSounds.play("ORDER_CANCELLED", { orderId: input.orderId });
      return result;
    },

    buildBoard(cards: OperationsOrderCard[], filters: OperationsFilters = {}, now = Date.now()) {
      const prioritized = withPriority(cards, now);
      const filtered = applyFilters(prioritized, filters, now);
      const columns = OPERATIONS_COLUMNS.map((col) => ({
        ...col,
        cards: filtered.filter((c) => columnForState(c.status) === col.id),
      }));
      return {
        columns,
        counters: computeCounters(prioritized, now),
        metrics: computeMetrics(prioritized, [], now),
        alerts: buildAlerts(prioritized, { now }),
      };
    },

    notifyIncoming(card: OperationsOrderCard) {
      KitchenSounds.play("NEW_ORDER", { orderId: card.id });
    },
  };
}

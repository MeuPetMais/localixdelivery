// RC5.2.a.2 — Auditoria do Delivery Assignment Domain.

export type DeliveryActor = "restaurant" | "driver" | "admin" | "system";

export interface DeliveryAuditContext {
  actor: DeliveryActor;
  actorId: string | null;
  correlationId: string;
  occurredAt?: string;
}

export function buildDeliveryAuditMetadata(
  ctx: DeliveryAuditContext,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    actor: ctx.actor,
    actor_id: ctx.actorId,
    correlation_id: ctx.correlationId,
    occurred_at: ctx.occurredAt ?? new Date().toISOString(),
    ...extra,
  };
}

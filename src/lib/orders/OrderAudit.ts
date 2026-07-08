// OrderAudit — captura contexto de execução (IP, origem, usuário, serviço).
// Estrutura pura; persistência é feita via metadata do histórico.
import type { OrderActorType } from "./OrderPermissions";

export interface OrderAuditContext {
  ip?: string | null;
  origin?: string | null;
  userId?: string | null;
  service?: string | null;
  actorType: OrderActorType;
  occurredAt?: string;
  // RC4.2: correlation_id propagado ponta-a-ponta (webhook → domain → timeline → logs).
  correlationId?: string | null;
}

export function buildAuditMetadata(
  ctx: OrderAuditContext,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    audit: {
      ip: ctx.ip ?? null,
      origin: ctx.origin ?? null,
      user_id: ctx.userId ?? null,
      service: ctx.service ?? null,
      actor_type: ctx.actorType,
      occurred_at: ctx.occurredAt ?? new Date().toISOString(),
      correlation_id: ctx.correlationId ?? null,
    },
    ...extra,
  };
}

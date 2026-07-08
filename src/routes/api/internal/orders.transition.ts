// RC4.2 — Endpoint interno para transições de status de pedidos.
// USO EXCLUSIVO por chamadores server-to-server (edge functions de webhook).
// Autenticação em dupla camada:
//   1. Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
//   2. x-internal-signature: HMAC-SHA256(rawBody, INTERNAL_TRANSITION_HMAC_SECRET)
// Falha qualquer camada → 401. Nunca exposto ao frontend.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { ORDER_STATES, type OrderState } from "@/lib/orders/OrderStateMachine";
import { createOrchestrator, type OrderSnapshot } from "@/lib/orders/OrderOrchestrator";
import type { OrderActorType } from "@/lib/orders/OrderPermissions";

const ActorSchema = z.enum([
  "customer",
  "restaurant",
  "admin",
  "system",
  "webhook",
  "courier",
]);

const InputSchema = z.object({
  orderId: z.string().uuid(),
  to: z.enum(ORDER_STATES as [OrderState, ...OrderState[]]),
  reason: z.string().max(500).optional(),
  actorType: ActorSchema,
  service: z.string().max(120).optional(),
  correlationId: z.string().max(120).optional(),
  metadata: z.record(z.unknown()).optional(),
});

function safeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

async function authenticate(request: Request, rawBody: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hmacSecret = process.env.INTERNAL_TRANSITION_HMAC_SECRET;
  if (!serviceKey || !hmacSecret) return { ok: false, error: "internal_auth_not_configured" };

  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!bearer || !safeEqualStr(bearer, serviceKey)) return { ok: false, error: "invalid_bearer" };

  const signature = request.headers.get("x-internal-signature") ?? "";
  if (!signature) return { ok: false, error: "missing_signature" };
  const expected = createHmac("sha256", hmacSecret).update(rawBody).digest("hex");
  if (!safeEqualStr(signature, expected)) return { ok: false, error: "invalid_signature" };
  return { ok: true };
}

export const Route = createFileRoute("/api/internal/orders/transition")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const authResult = await authenticate(request, rawBody);
        if (!authResult.ok) {
          return new Response(JSON.stringify({ ok: false, error: authResult.error }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        let parsed: z.infer<typeof InputSchema>;
        try {
          parsed = InputSchema.parse(JSON.parse(rawBody));
        } catch (err) {
          return new Response(
            JSON.stringify({ ok: false, error: "invalid_payload", detail: String((err as Error).message) }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }

        const correlationId = parsed.correlationId ?? randomUUID();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const orchestrator = createOrchestrator({
          getOrder: async (id): Promise<OrderSnapshot | null> => {
            const { data } = await supabaseAdmin
              .from("orders")
              .select("id, restaurant_id, status")
              .eq("id", id)
              .maybeSingle();
            if (!data) return null;
            return { id: data.id, restaurant_id: data.restaurant_id, status: data.status as OrderState };
          },
          // Não usados no path atômico, mas exigidos pelo tipo.
          updateOrderStatus: async () => {},
          insertHistory: async () => {},
          applyAtomic: async (row) => {
            const { data, error } = await supabaseAdmin.rpc("order_apply_transition", {
              _order_id: row.order_id,
              _expected_from: row.expected_from,
              _next_status: row.next_status,
              _reason: row.reason ?? "",
              _actor_type: row.performed_by_type,
              _actor_id: row.performed_by ?? "00000000-0000-0000-0000-000000000000",
              _metadata: row.metadata as never,

            });
            if (error) throw new Error(`rpc_failed:${error.message}`);
            const result = data as { ok: boolean; reason?: string; current?: string; expected?: string } | null;
            if (!result?.ok) {
              throw new Error(`rpc_rejected:${result?.reason ?? "UNKNOWN"}`);
            }
          },
        });

        try {
          const result = await orchestrator.transition({
            orderId: parsed.orderId,
            to: parsed.to,
            reason: parsed.reason,
            audit: {
              actorType: parsed.actorType as OrderActorType,
              service: parsed.service ?? "internal.orders.transition",
              correlationId,
            },
            metadata: parsed.metadata,
          });
          const status = result.ok ? 200 : 409;
          return new Response(JSON.stringify({ ...result, correlationId }), {
            status,
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[internal.orders.transition] failed", { correlationId, msg });
          return new Response(
            JSON.stringify({ ok: false, error: msg, correlationId }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});

// RC4.2 — Cliente interno para transicionar status de pedidos.
// Usado por edge functions de webhook (Stripe, Mercado Pago). Encapsula:
//   - URL do endpoint interno (env INTERNAL_TRANSITION_URL, fallback published URL)
//   - HMAC signature (INTERNAL_TRANSITION_HMAC_SECRET)
//   - HMAC signature (INTERNAL_TRANSITION_HMAC_SECRET)
//   - fallback direto por RPC transacional se a rota pública ainda estiver com
//     deploy antigo/autenticação divergente. Nunca faz UPDATE direto em orders.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const DEFAULT_URL =
  "https://project--70a38eb3-fee3-4e1f-b87d-610ac1cf7faf.lovable.app/api/public/orders/transition";

export type OrderTransitionActor =
  | "customer" | "restaurant" | "admin" | "system" | "webhook" | "courier";

export interface OrderTransitionRequest {
  orderId: string;
  to: string;
  reason?: string;
  actorType: OrderTransitionActor;
  service: string;
  correlationId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface OrderTransitionResponse {
  ok: boolean;
  from?: string | null;
  to?: string;
  reason?: string;
  error?: string;
  correlationId?: string;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const IDEMPOTENT_APPROVED_STATES = new Set([
  "pago", "aceito", "em_preparo", "pronto", "saiu_para_entrega", "entregue", "concluido",
]);

const DIRECT_ALLOWED: Record<string, string[]> = {
  aguardando_pagamento: ["pago", "falha_pagamento"],
  pago: ["reembolsado", "chargeback"],
  aceito: ["reembolsado"],
  entregue: ["reembolsado", "chargeback"],
  concluido: ["reembolsado", "chargeback"],
};

function shouldUseDirectFallback(res: OrderTransitionResponse): boolean {
  const marker = String(res.error ?? "");
  return (
    marker.startsWith("network:") ||
    marker.startsWith("bad_response:") ||
    marker === "invalid_bearer" ||
    marker === "missing_signature" ||
    marker === "invalid_signature" ||
    marker === "internal_auth_not_configured"
  );
}

async function transitionOrderDirect(req: OrderTransitionRequest, fallbackReason: string): Promise<OrderTransitionResponse> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return { ok: false, error: "direct_transition_not_configured" };

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: order, error: orderErr } = await sb
    .from("orders")
    .select("id, restaurant_id, status")
    .eq("id", req.orderId)
    .maybeSingle();
  if (orderErr) return { ok: false, error: `direct_order_lookup:${orderErr.message}` };
  if (!order) return { ok: false, reason: "ORDER_NOT_FOUND" };

  const current = String(order.status);
  if (current === req.to || (req.to === "pago" && IDEMPOTENT_APPROVED_STATES.has(current))) {
    return { ok: true, from: current, to: current, correlationId: req.correlationId ?? undefined };
  }
  if (!(DIRECT_ALLOWED[current] ?? []).includes(req.to)) {
    return { ok: false, from: current, to: req.to, reason: "INVALID_TRANSITION" };
  }

  const { data, error } = await sb.rpc("order_apply_transition", {
    _order_id: req.orderId,
    _expected_from: current,
    _next_status: req.to,
    _reason: req.reason ?? fallbackReason,
    _actor_type: req.actorType,
    _actor_id: null,
    _metadata: {
      ...(req.metadata ?? {}),
      audit: {
        actor_type: req.actorType,
        service: req.service,
        correlation_id: req.correlationId ?? null,
        fallback_reason: fallbackReason,
      },
    },
  });
  if (error) return { ok: false, error: `direct_rpc:${error.message}` };
  const result = data as { ok?: boolean; reason?: string; previous?: string; current?: string } | null;
  if (!result?.ok) return { ok: false, from: current, to: req.to, reason: result?.reason ?? "RPC_REJECTED" };
  return { ok: true, from: result.previous ?? current, to: result.current ?? req.to, correlationId: req.correlationId ?? undefined };
}

export async function transitionOrder(req: OrderTransitionRequest): Promise<OrderTransitionResponse> {
  const url = Deno.env.get("INTERNAL_TRANSITION_URL") ?? DEFAULT_URL;
  const bearer = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secret = Deno.env.get("INTERNAL_TRANSITION_HMAC_SECRET");
  if (!bearer || !secret) {
    return { ok: false, error: "internal_transition_not_configured" };
  }
  const body = JSON.stringify(req);
  const signature = await hmacHex(secret, body);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${bearer}`,
        "x-internal-signature": signature,
      },
      body,
    });
    const text = await res.text();
    let parsed: OrderTransitionResponse;
    try { parsed = JSON.parse(text); } catch { parsed = { ok: false, error: `bad_response:${text.slice(0, 120)}` }; }
    if (!res.ok && parsed.ok === undefined) parsed.ok = false;
    if (!parsed.ok && shouldUseDirectFallback(parsed)) {
      console.warn("[order-transition] HTTP transition failed; using direct RPC fallback", {
        orderId: req.orderId,
        to: req.to,
        error: parsed.error,
      });
      return await transitionOrderDirect(req, parsed.error ?? "http_transition_failed");
    }
    return parsed;
  } catch (err) {
    const error = `network:${err instanceof Error ? err.message : String(err)}`;
    console.warn("[order-transition] HTTP transition network error; using direct RPC fallback", {
      orderId: req.orderId,
      to: req.to,
      error,
    });
    return await transitionOrderDirect(req, error);
  }
}

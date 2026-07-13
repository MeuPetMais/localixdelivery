// RC4.2 — Cliente interno para transicionar status de pedidos.
// Usado por edge functions de webhook (Stripe, Mercado Pago). Encapsula:
//   - URL do endpoint interno (env INTERNAL_TRANSITION_URL, fallback published URL)
//   - Bearer auth (SUPABASE_SERVICE_ROLE_KEY)
//   - HMAC signature (INTERNAL_TRANSITION_HMAC_SECRET)
// Nenhum UPDATE direto em orders acontece aqui — só HTTP para o Order Domain.

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
    return parsed;
  } catch (err) {
    return { ok: false, error: `network:${err instanceof Error ? err.message : String(err)}` };
  }
}

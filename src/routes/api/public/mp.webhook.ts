// Endpoint público que o Mercado Pago chama.
// Apenas reencaminha para a Edge Function `mp-webhook`, preservando corpo
// e headers de assinatura. Nunca vê tokens.

import { createFileRoute } from "@tanstack/react-router";

async function proxy(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return new Response("Backend indisponível", { status: 500 });
  const target = new URL("/functions/v1/mp-webhook", supabaseUrl);
  const url = new URL(request.url);
  for (const [k, v] of url.searchParams) target.searchParams.set(k, v);

  const headers = new Headers();
  for (const h of ["x-signature", "x-request-id", "content-type", "user-agent"]) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("apikey", process.env.SUPABASE_PUBLISHABLE_KEY ?? "");

  const body = request.method === "GET" ? undefined : await request.text();
  const res = await fetch(target.toString(), { method: request.method, headers, body });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export const Route = createFileRoute("/api/public/mp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => proxy(request),
      GET: async ({ request }) => proxy(request), // MP às vezes valida com GET
    },
  },
});

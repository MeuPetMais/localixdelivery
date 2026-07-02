// Callback público que o Mercado Pago chama após o consentimento OAuth.
// Encaminha para a Edge Function `mp-oauth-callback` (que faz a troca do
// authorization_code e persiste os tokens cifrados).
//
// Este endpoint NUNCA vê tokens: só reencaminha `code` e `state`.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mp/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const supabaseUrl = process.env.SUPABASE_URL;
        if (!supabaseUrl) {
          return new Response("Backend indisponível", { status: 500 });
        }
        const target = new URL(
          "/functions/v1/mp-oauth-callback",
          supabaseUrl,
        );
        for (const [k, v] of url.searchParams) target.searchParams.set(k, v);

        const res = await fetch(target.toString(), {
          method: "GET",
          headers: {
            apikey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
          },
          redirect: "manual",
        });

        const location = res.headers.get("location");
        if (location) {
          return new Response(null, { status: 302, headers: { location } });
        }
        return new Response(await res.text(), {
          status: res.status,
          headers: { "content-type": res.headers.get("content-type") ?? "text/plain" },
        });
      },
    },
  },
});

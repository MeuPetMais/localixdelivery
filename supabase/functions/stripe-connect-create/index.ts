// Stripe Connect — Create Express account + Account Link.
// - Exige JWT do owner (a Edge Function é chamada via supabase.functions.invoke,
//   que injeta o Authorization Bearer do usuário autenticado).
// - Valida que o auth.uid() é o owner do restaurante.
// - Cria a conta Express na Stripe se ainda não existir.
// - Gera Account Link de onboarding e devolve a URL.
// - Persiste stripe_account_id em public.restaurants.
// - Se `onlyLink=true`, apenas gera novo link para conta existente.
// - Se `disconnect=true`, limpa colunas locais (não deleta na Stripe).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function stripe(path: string, secret: string, body?: Record<string, string>) {
  const init: RequestInit = {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (body) init.body = new URLSearchParams(body).toString();
  const res = await fetch(`https://api.stripe.com/v1${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[stripe] ${path} → ${res.status}`, JSON.stringify(data));
    throw new Error(`Stripe: ${data?.error?.message ?? `HTTP ${res.status}`}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

  const secret = Deno.env.get("STRIPE_SECRET_KEY_TEST");
  if (!secret || !secret.startsWith("sk_")) {
    return json({ error: "stripe_secret_missing" }, { status: 500 });
  }

  // Autenticação do caller (owner do restaurante)
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, { status: 401 });

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
  const { data: userData, error: uerr } = await authClient.auth.getUser();
  if (uerr || !userData?.user) return json({ error: "unauthorized" }, { status: 401 });
  const userId = userData.user.id;
  const userEmail = userData.user.email ?? null;

  const body = await req.json().catch(() => ({}));
  const restaurantId: string | null = body?.restaurantId ?? null;
  const returnUrl: string = body?.returnUrl ?? "";
  const refreshUrl: string = body?.refreshUrl ?? returnUrl;
  const onlyLink: boolean = !!body?.onlyLink;
  const disconnect: boolean = !!body?.disconnect;

  if (!restaurantId) return json({ error: "missing_restaurant" }, { status: 400 });

  const db = admin();

  const { data: rest, error: rerr } = await db
    .from("restaurants")
    .select("id, owner_id, email, stripe_account_id, stripe_account_status")
    .eq("id", restaurantId)
    .maybeSingle();
  if (rerr || !rest) return json({ error: "restaurant_not_found" }, { status: 404 });
  if (rest.owner_id !== userId) return json({ error: "forbidden" }, { status: 403 });

  // Disconnect local
  if (disconnect) {
    await db
      .from("restaurants")
      .update({
        stripe_account_id: null,
        stripe_account_status: "not_created",
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
        stripe_details_submitted: false,
        stripe_onboarding_completed: false,
        stripe_last_sync: new Date().toISOString(),
      })
      .eq("id", restaurantId);
    return json({ ok: true, disconnected: true });
  }

  try {
    let accountId = rest.stripe_account_id as string | null;

    if (!accountId && !onlyLink) {
      const emailForStripe = (rest.email ?? userEmail ?? "").trim();
      const accountParams: Record<string, string> = {
        type: "express",
        country: "BR",
        "capabilities[card_payments][requested]": "true",
        "capabilities[transfers][requested]": "true",
        "capabilities[pix_payments][requested]": "true",
        "metadata[restaurant_id]": restaurantId,
        "metadata[owner_id]": userId,
      };

      if (emailForStripe) accountParams.email = emailForStripe;

      let created;
      try {
        created = await stripe("/accounts", secret, accountParams);
      } catch (e) {
        console.error("[stripe-connect-create] accounts.create failed", (e as Error).message);
        throw e;
      }
      accountId = created.id as string;

      await db
        .from("restaurants")
        .update({
          stripe_account_id: accountId,
          stripe_account_type: "express",
          stripe_account_status: "onboarding_pending",
          stripe_last_sync: new Date().toISOString(),
        })
        .eq("id", restaurantId);
    }

    if (!accountId) return json({ error: "no_account" }, { status: 400 });

    const link = await stripe("/account_links", secret, {
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return json({
      accountId,
      onboardingUrl: link.url,
      url: link.url,
      expiresAt: new Date((link.expires_at as number) * 1000).toISOString(),
    });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }
});

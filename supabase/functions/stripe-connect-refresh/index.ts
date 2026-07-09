// Stripe Connect — Refresh account snapshot.
// Consulta a Stripe (accounts.retrieve), atualiza colunas em public.restaurants
// e devolve o snapshot atual.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function stripeGet(path: string, secret: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe: ${data?.error?.message ?? "stripe_error"}`);
  return data;
}

function statusOf(a: any): string {
  if (a.charges_enabled && a.payouts_enabled && a.details_submitted) return "active";
  if (a.requirements?.disabled_reason) return "restricted";
  if (a.details_submitted) return "onboarding_pending";
  return "onboarding_pending";
}

function capState(cap: string | undefined): "active" | "pending" | "inactive" {
  if (cap === "active") return "active";
  if (cap === "pending") return "pending";
  return "inactive";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

  const secret = Deno.env.get("STRIPE_SECRET_KEY_TEST");
  if (!secret) return json({ error: "stripe_secret_missing" }, { status: 500 });

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

  const body = await req.json().catch(() => ({}));
  const restaurantId: string | null = body?.restaurantId ?? null;
  if (!restaurantId) return json({ error: "missing_restaurant" }, { status: 400 });

  const db = admin();
  const { data: rest } = await db
    .from("restaurants")
    .select("id, owner_id, stripe_account_id")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!rest) return json({ error: "restaurant_not_found" }, { status: 404 });
  if (rest.owner_id !== userId) return json({ error: "forbidden" }, { status: 403 });
  if (!rest.stripe_account_id) {
    return json({
      accountId: null,
      status: "not_created",
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      onboardingCompleted: false,
      lastSync: null,
      capabilities: { card: "inactive", pix: "inactive", transfers: "inactive" },
    });
  }

  try {

    const a = await stripeGet(`/accounts/${rest.stripe_account_id}`, secret);

    const status = statusOf(a);
    const nowIso = new Date().toISOString();

    await db
      .from("restaurants")
      .update({
        stripe_account_status: status,
        stripe_charges_enabled: !!a.charges_enabled,
        stripe_payouts_enabled: !!a.payouts_enabled,
        stripe_details_submitted: !!a.details_submitted,
        stripe_onboarding_completed: !!a.details_submitted,
        stripe_last_sync: nowIso,
      })
      .eq("id", restaurantId);

    return json({
      accountId: a.id,
      status,
      chargesEnabled: !!a.charges_enabled,
      payoutsEnabled: !!a.payouts_enabled,
      detailsSubmitted: !!a.details_submitted,
      onboardingCompleted: !!a.details_submitted,
      lastSync: nowIso,
      capabilities: {
        card: capState(a.capabilities?.card_payments),
        pix: capState(a.capabilities?.pix_payments),
        transfers: capState(a.capabilities?.transfers),
      },
    });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }
});

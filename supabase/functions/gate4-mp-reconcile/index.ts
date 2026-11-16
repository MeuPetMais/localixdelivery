// Isolated Gate 4, one order only, strictly read-only. NEVER deploy outside dedicated sandbox.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decryptToken } from "../_shared/crypto.ts";
import { assertMpExpectedTestSeller, assertMpSellerTokenMode } from "../_shared/mp-payment-environment.ts";
import {
  GATE4_PROJECT, GATE4_RESTAURANT, GATE4_ORDER, GATE4_SELLER,
  GATE4_IDEMPOTENCY, searchUrl, sanitizePayments, remainingPages, completeSearch,
} from "./reconcile-core.ts";

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  // No OPTIONS/CORS access: callable only by an authenticated operator, not a public storefront.
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  if (
    Deno.env.get("SUPABASE_URL") !== GATE4_PROJECT ||
    Deno.env.get("MP_ENVIRONMENT") !== "test" ||
    Deno.env.get("MP_TEST_SELLER_USER_ID") !== GATE4_SELLER
  ) return reply({ error: "sandbox_environment_not_verified" }, 503);

  const bearer = req.headers.get("authorization") ?? "";
  const jwt = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : "";
  if (!jwt) return reply({ error: "unauthorized" }, 401);

  // Internal service role is never used as a substitute for caller identity.
  const sb = createClient(
    GATE4_PROJECT,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: auth, error: authError } = await sb.auth.getUser(jwt);
  if (authError || !auth?.user?.id) return reply({ error: "unauthorized" }, 401);

  try {
    const { data: restaurant, error: restaurantError } = await sb
      .from("restaurants").select("id, owner_id, active, is_open")
      .eq("id", GATE4_RESTAURANT).maybeSingle();
    if (restaurantError || !restaurant ||
      restaurant.owner_id !== auth.user.id ||
      restaurant.active !== false || restaurant.is_open !== false) {
      return reply({ error: "owner_or_restaurant_not_authorized" }, 403);
    }

    const { data: order, error: orderError } = await sb
      .from("orders").select("id, restaurant_id, total, status")
      .eq("id", GATE4_ORDER).maybeSingle();
    if (orderError || !order || order.restaurant_id !== GATE4_RESTAURANT ||
      order.status !== "aguardando_pagamento" || Math.abs(Number(order.total) - 30.99) > 0.001) {
      return reply({ error: "expected_order_not_found" }, 409);
    }

    const { data: account, error: accountError } = await sb
      .from("mercado_pago_accounts")
      .select("access_token, connected, live_mode, mp_user_id")
      .eq("restaurant_id", GATE4_RESTAURANT).maybeSingle();
    if (accountError || !account?.connected ||
      String(account.mp_user_id) !== GATE4_SELLER ||
      account.live_mode !== false ||
      typeof account.access_token !== "string" || !account.access_token.startsWith("v1:")) {
      return reply({ error: "seller_oauth_not_verified" }, 409);
    }

    const token = await decryptToken(account.access_token);
    assertMpSellerTokenMode("test", account.live_mode, token);
    assertMpExpectedTestSeller("test", account.mp_user_id, GATE4_SELLER);

    const results = [];
    let expectedTotal: number | null = null;
    let fetchedPages = 0;
    for (let page = 0; page < 4; page++) {
      // GET only. Never send X-Idempotency-Key on a diagnostic search.
      const upstream = await fetch(searchUrl(page * 50), {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      if (!upstream.ok) {
        return reply({ error: "gateway_search_failed", http_status: upstream.status,
          complete: false, retry_allowed: false }, 502);
      }
      const data = sanitizePayments(await upstream.json());
      if (expectedTotal !== null && data.total !== expectedTotal)
        return reply({ error: "gateway_pagination_changed", complete: false, retry_allowed: false }, 502);
      expectedTotal = data.total;
      results.push(...data.payments);
      fetchedPages++;
      if (fetchedPages >= remainingPages(data.total)) break;
    }

    const total = expectedTotal ?? 0;
    const complete = completeSearch(total, results.length);
    return reply({
      order_id: GATE4_ORDER,
      external_reference: GATE4_ORDER,
      expected_idempotency_key: GATE4_IDEMPOTENCY,
      seller_user_id: GATE4_SELLER,
      search_scope: "seller_oauth_test_only",
      total,
      results,
      complete,
      // A zero-result seller search does NOT prove absence in other credentials/app contexts.
      retry_allowed: false,
      conclusion: !complete ? "INCONCLUSIVE" : results.length ? "PAYMENT_FOUND_RECONCILE_FIRST" : "NONE_FOUND_IN_THIS_SELLER_SCOPE",
    });
  } catch (_error) {
    // Do not log or echo gateway responses, OAuth, JWT or secret details.
    return reply({ error: "reconciliation_internal_error", complete: false, retry_allowed: false }, 500);
  }
});

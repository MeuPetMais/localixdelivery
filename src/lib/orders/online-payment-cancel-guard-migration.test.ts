import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260915153005_online_payment_cancel_guard.sql"),
  "utf8",
);
const normalizedSql = migrationSql.replace(/\s+/g, " ").trim();
const normalizedLower = normalizedSql.toLowerCase();
const executableSql = migrationSql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");
const normalizedExecutableLower = executableSql.replace(/\s+/g, " ").trim().toLowerCase();

const ordersSource = readFileSync(
  resolve(process.cwd(), "src/lib/orders/orders.functions.ts"),
  "utf8",
);

const guardBlock = migrationSql.slice(
  migrationSql.indexOf("IF _next_status = 'cancelado'"),
  migrationSql.indexOf("IF NULLIF(BTRIM(COALESCE(v_address"),
);

const cancelFunction = ordersSource.slice(
  ordersSource.indexOf("export const cancelRestaurantOrder"),
);
const transitionFunction = ordersSource.slice(
  ordersSource.indexOf("export const transitionOrderStatus"),
  ordersSource.indexOf("export const cancelRestaurantOrder"),
);

const currentTransitionMatrix = [
  "(v_current = 'novo' AND _next_status IN ('aguardando_pagamento', 'cancelado'))",
  "(v_current = 'aguardando_pagamento' AND _next_status IN ('pago', 'falha_pagamento', 'cancelado'))",
  "(v_current = 'pago' AND _next_status IN ('aceito', 'rejeitado', 'reembolsado', 'chargeback', 'cancelado'))",
  "(v_current = 'falha_pagamento' AND _next_status IN ('aguardando_pagamento', 'cancelado'))",
  "(v_current = 'aceito' AND _next_status IN ('em_preparo', 'cancelado', 'reembolsado'))",
  "(v_current = 'em_preparo' AND _next_status IN ('pronto', 'cancelado'))",
  "(v_current = 'pronto' AND _next_status IN ('saiu_para_entrega', 'entregue', 'concluido', 'cancelado'))",
  "(v_current = 'saiu_para_entrega' AND _next_status IN ('entregue', 'cancelado'))",
  "(v_current = 'entregue' AND _next_status IN ('concluido', 'reembolsado', 'chargeback'))",
  "(v_current = 'concluido' AND _next_status IN ('reembolsado', 'chargeback'))",
];

const currentActorRules = [
  "(_actor_type = 'customer' AND _next_status IN ('novo', 'cancelado'))",
  "'aceito', 'rejeitado', 'em_preparo', 'pronto',\n      'saiu_para_entrega', 'entregue', 'concluido', 'cancelado'",
  "'pago', 'falha_pagamento', 'aceito', 'rejeitado', 'em_preparo',\n      'pronto', 'saiu_para_entrega', 'entregue', 'concluido',\n      'cancelado', 'reembolsado', 'chargeback'",
  "'novo', 'aguardando_pagamento', 'pago', 'falha_pagamento',\n      'concluido', 'cancelado', 'reembolsado', 'chargeback'",
  "(_actor_type = 'webhook' AND _next_status IN (\n      'pago', 'falha_pagamento', 'reembolsado', 'chargeback'\n    ))",
  "(_actor_type = 'courier' AND _next_status IN ('saiu_para_entrega', 'entregue'))",
];

describe("online payment cancel guard migration", () => {
  it("blocks direct cancelado for approved Mercado Pago online payments with gateway payment_id", () => {
    expect(guardBlock).toContain("_next_status = 'cancelado'");
    expect(guardBlock).toContain("FROM public.order_payment op");
    expect(guardBlock).toContain("op.order_id = _order_id");
    expect(guardBlock).toContain("op.provider = 'mercado_pago'");
    expect(guardBlock).toContain("op.status = 'APPROVED'");
    expect(guardBlock).toContain("op.payment_method IN ('pix', 'credit_card')");
    expect(guardBlock).toContain("NULLIF(BTRIM(COALESCE(op.payment_id, '')), '') IS NOT NULL");
    expect(guardBlock).toContain("'ONLINE_PAYMENT_REFUND_REQUIRED'");
  });

  it("runs the guard after transition and actor validation but before updating orders", () => {
    const invalidTransitionIndex = migrationSql.indexOf("'INVALID_TRANSITION'");
    const forbiddenActorIndex = migrationSql.indexOf("'FORBIDDEN_ACTOR'");
    const guardIndex = migrationSql.indexOf("'ONLINE_PAYMENT_REFUND_REQUIRED'");
    const updateIndex = migrationSql.indexOf("UPDATE public.orders");

    expect(invalidTransitionIndex).toBeGreaterThan(0);
    expect(forbiddenActorIndex).toBeGreaterThan(invalidTransitionIndex);
    expect(guardIndex).toBeGreaterThan(forbiddenActorIndex);
    expect(guardIndex).toBeLessThan(updateIndex);
  });

  it("does not execute refund or mutate payment tables inside order_apply_transition", () => {
    expect(normalizedExecutableLower).not.toContain("mp-payment-intent");
    expect(normalizedLower).not.toContain("update public.order_payment");
    expect(normalizedLower).not.toContain("update public.payments");
    expect(normalizedLower).not.toContain("financial_ledger");
  });

  it("preserves function signature, SECURITY DEFINER, search_path, and does not alter grants", () => {
    expect(normalizedSql).toContain(
      "CREATE OR REPLACE FUNCTION public.order_apply_transition( _order_id uuid, _expected_from text, _next_status text, _reason text, _actor_type text, _actor_id uuid, _metadata jsonb ) RETURNS jsonb",
    );
    expect(normalizedSql).toContain("SECURITY DEFINER");
    expect(normalizedSql).toContain("SET search_path = public");
    expect(normalizedLower).not.toContain("grant execute");
    expect(normalizedLower).not.toContain("revoke execute");
    expect(normalizedLower).not.toContain("grant update");
    expect(normalizedLower).not.toContain("revoke update");
  });

  it("preserves cash/offline and unconfirmed gateway behavior by narrowing the predicate", () => {
    expect(guardBlock).not.toContain("'cash'");
    expect(guardBlock).not.toContain("'card_on_delivery'");
    expect(guardBlock).not.toContain("'debit_card'");
    expect(guardBlock).not.toContain("'meal_voucher'");
    expect(guardBlock).toContain("op.payment_method IN ('pix', 'credit_card')");
    expect(guardBlock).toContain("op.status = 'APPROVED'");
    expect(guardBlock).toContain("op.payment_id");
  });

  it("does not block legitimate reembolsado transitions", () => {
    expect(guardBlock).not.toContain("_next_status = 'reembolsado'");
    expect(normalizedSql).toContain(
      "(v_current = 'pago' AND _next_status IN ('aceito', 'rejeitado', 'reembolsado', 'chargeback', 'cancelado'))",
    );
    expect(normalizedSql).toContain(
      "(v_current = 'aceito' AND _next_status IN ('em_preparo', 'cancelado', 'reembolsado'))",
    );
    expect(normalizedSql).toContain("WHEN _next_status IN ('reembolsado', 'chargeback') THEN 0");
  });

  it("preserves the currently audited transition matrix instead of copying an older RPC", () => {
    for (const transitionRule of currentTransitionMatrix) {
      expect(normalizedSql).toContain(transitionRule);
    }

    expect(normalizedSql).not.toContain(
      "(v_current = 'pronto' AND _next_status IN ('saiu_para_entrega', 'entregue', 'cancelado'))",
    );
  });

  it("preserves the currently audited actor matrix", () => {
    for (const actorRule of currentActorRules) {
      expect(migrationSql).toContain(actorRule);
    }

    expect(normalizedSql).toContain("'FORBIDDEN_ACTOR'");
    expect(normalizedSql).toContain("'current', v_current");
    expect(normalizedSql).toContain("'requested', _next_status");
    expect(normalizedSql).toContain("'actor_type', _actor_type");
  });

  it("preserves auth.uid, service_role bypass, and ownership validations", () => {
    expect(migrationSql).toContain(
      "v_is_service_role boolean := COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role';",
    );
    expect(migrationSql).toContain("v_auth_uid uuid := auth.uid();");
    expect(migrationSql).toContain("IF NOT v_is_service_role THEN");
    expect(migrationSql).toContain("IF v_auth_uid IS NULL THEN");
    expect(migrationSql).toContain("_actor_type IN ('system', 'webhook')");
    expect(migrationSql).toContain(
      "_actor_type = 'admin' AND NOT public.has_role(v_auth_uid, 'admin'::public.app_role)",
    );
    expect(migrationSql).toContain("WHERE r.id = v_restaurant_id");
    expect(migrationSql).toContain("AND r.owner_id = v_auth_uid");
    expect(migrationSql).toContain("v_customer_id IS DISTINCT FROM v_auth_uid");
    expect(migrationSql).toContain("JOIN public.delivery_drivers dd ON dd.id = da.driver_id");
    expect(migrationSql).toContain("AND dd.owner_id = v_auth_uid");
  });

  it("preserves delivery assignment guards, realized revenue snapshot, history insert, and success JSON", () => {
    expect(migrationSql).toContain("'DELIVERY_ASSIGNMENT_REQUIRED'");
    expect(migrationSql).toContain("'DELIVERY_ASSIGNMENT_FLOW_REQUIRED'");
    expect(migrationSql).toContain("COALESCE(v_assignment_status, '') <> 'EM_ROTA'");
    expect(migrationSql).toContain("COALESCE(v_assignment_status, '') <> 'ENTREGUE'");
    expect(migrationSql).toContain("UPDATE public.order_pricing_snapshot");
    expect(migrationSql).toContain("realized_platform_revenue = CASE");
    expect(migrationSql).toContain(
      "WHEN _next_status IN ('entregue', 'concluido') THEN platform_revenue",
    );
    expect(migrationSql).toContain("WHEN _next_status IN ('reembolsado', 'chargeback') THEN 0");
    expect(migrationSql).toContain("INSERT INTO public.order_status_history");
    expect(migrationSql).toContain("COALESCE(_metadata, '{}'::jsonb)");
    expect(migrationSql).toContain("'ok', true");
    expect(migrationSql).toContain("'previous', v_current");
    expect(migrationSql).toContain("'current', _next_status");
    expect(migrationSql).toContain("'history_id', v_history_id");
  });
});

describe("application cancellation paths with the central guard", () => {
  it("keeps cancelRestaurantOrder as the online approved refund path", () => {
    expect(cancelFunction).toContain("isApprovedMercadoPagoPayment(payment)");
    expect(cancelFunction).toContain("supabaseAdmin.functions.invoke(");
    expect(cancelFunction).toContain('"mp-payment-intent"');
    expect(cancelFunction).toContain('body: { action: "refund", order_id: data.orderId }');
    expect(cancelFunction).toContain('refund?.status !== "REFUNDED"');
    expect(cancelFunction).toContain('status: "reembolsado"');
  });

  it("preserves operational cash cancellation through the central RPC", () => {
    expect(cancelFunction).toContain('to: "cancelado"');
    expect(cancelFunction).toContain('reason: "restaurant_cancelled"');
    expect(cancelFunction).toContain('service: "orders.cancelRestaurantOrder"');
    expect(cancelFunction).toContain('rpc("order_apply_transition"');
  });

  it("lets transitionOrderStatus surface RPC rejection for direct online cancel attempts", () => {
    expect(transitionFunction).toContain('rpc("order_apply_transition"');
    expect(transitionFunction).toContain(
      'throw new Error(`RPC_REJECTED:${result?.reason ?? "UNKNOWN"}`)',
    );
    expect(transitionFunction).not.toContain("order_payment");
    expect(transitionFunction).not.toContain("mp-payment-intent");
  });
});

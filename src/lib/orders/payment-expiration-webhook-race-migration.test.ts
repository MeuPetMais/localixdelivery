import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260916160615_payment_expiration_webhook_race_guard.sql",
  ),
  "utf8",
);

const executableSql = migrationSql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");
const normalizedSql = migrationSql.replace(/\s+/g, " ").trim();
const normalizedLower = normalizedSql.toLowerCase();
const normalizedExecutableLower = executableSql.replace(/\s+/g, " ").trim().toLowerCase();

const webhookSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/mp-webhook/index.ts"),
  "utf8",
);
const transitionHelperSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/_shared/order-transition.ts"),
  "utf8",
);

const expireFunction = migrationSql.slice(
  migrationSql.indexOf("CREATE OR REPLACE FUNCTION public.expire_pending_payment_orders()"),
  migrationSql.indexOf("CREATE OR REPLACE FUNCTION public.order_apply_transition("),
);

const transitionFunction = migrationSql.slice(
  migrationSql.indexOf("CREATE OR REPLACE FUNCTION public.order_apply_transition("),
);

const recoveryBlock = transitionFunction.slice(
  transitionFunction.indexOf("IF v_current = 'falha_pagamento' AND _next_status = 'pago' THEN"),
  transitionFunction.indexOf("IF NOT v_is_service_role THEN"),
);

const cancelGuardBlock = transitionFunction.slice(
  transitionFunction.indexOf("IF _next_status = 'cancelado'"),
  transitionFunction.indexOf("IF NULLIF(BTRIM(COALESCE(v_address"),
);

const currentTransitionRules = [
  "(v_current = 'novo' AND _next_status IN ('aguardando_pagamento', 'cancelado'))",
  "(v_current = 'aguardando_pagamento' AND _next_status IN ('pago', 'falha_pagamento', 'cancelado'))",
  "(v_current = 'pago' AND _next_status IN ('aceito', 'rejeitado', 'reembolsado', 'chargeback', 'cancelado'))",
  "(v_current = 'falha_pagamento' AND _next_status IN ('aguardando_pagamento', 'pago', 'cancelado'))",
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

describe("payment expiration webhook race guard migration", () => {
  it("keeps the migration forward-only and limited to the two involved functions", () => {
    expect(normalizedSql).toContain(
      "CREATE OR REPLACE FUNCTION public.expire_pending_payment_orders()",
    );
    expect(normalizedSql).toContain(
      "CREATE OR REPLACE FUNCTION public.order_apply_transition( _order_id uuid, _expected_from text, _next_status text, _reason text, _actor_type text, _actor_id uuid, _metadata jsonb ) RETURNS jsonb",
    );
    expect(normalizedLower).not.toContain("create table");
    expect(normalizedLower).not.toContain("alter table");
    expect(normalizedLower).not.toContain("drop function");
    expect(normalizedLower).not.toContain("grant ");
    expect(normalizedLower).not.toContain("revoke ");
  });

  it("locks only eligible aguardando_pagamento rows with SKIP LOCKED before expiring", () => {
    expect(expireFunction).toContain("WHERE status = 'aguardando_pagamento'");
    expect(expireFunction).toContain("AND created_at < now() - interval '15 minutes'");
    expect(expireFunction).toContain("LIMIT 500");
    expect(expireFunction).toContain("FOR UPDATE SKIP LOCKED");
    expect(expireFunction).toContain("'aguardando_pagamento'");
    expect(expireFunction).toContain("'falha_pagamento'");
    expect(expireFunction).toContain("'auto_expire:15min'");
    expect(expireFunction).toContain("'system'");
  });

  it("revalidates approved Mercado Pago online evidence under the expiration lock", () => {
    const lockIndex = expireFunction.indexOf("FOR UPDATE SKIP LOCKED");
    const evidenceIndex = expireFunction.indexOf("FROM public.order_payment op");
    const transitionIndex = expireFunction.indexOf("PERFORM public.order_apply_transition");

    expect(lockIndex).toBeGreaterThan(0);
    expect(evidenceIndex).toBeGreaterThan(lockIndex);
    expect(transitionIndex).toBeGreaterThan(evidenceIndex);
    expect(expireFunction).toContain("op.provider = 'mercado_pago'");
    expect(expireFunction).toContain("op.status = 'APPROVED'");
    expect(expireFunction).toContain("op.payment_method IN ('pix', 'credit_card')");
    expect(expireFunction).toContain("NULLIF(BTRIM(COALESCE(op.payment_id, '')), '') IS NOT NULL");
    expect(expireFunction).toContain("p.provider = 'mercado_pago'");
    expect(expireFunction).toContain("p.status = 'approved'");
    expect(expireFunction).toContain("p.method IN ('pix', 'card', 'credit_card')");
    expect(expireFunction).toContain("NULLIF(BTRIM(COALESCE(p.external_id, '')), '') IS NOT NULL");
  });

  it("does not let pending, empty-id, cash, or offline rows bypass expiration", () => {
    expect(expireFunction).not.toContain("op.status = 'PENDING'");
    expect(expireFunction).not.toContain("p.status = 'pending'");
    expect(expireFunction).not.toContain("'cash'");
    expect(expireFunction).not.toContain("'card_on_delivery'");
    expect(expireFunction).not.toContain("'debit_card'");
    expect(expireFunction).not.toContain("'meal_voucher'");
    expect(expireFunction).toContain("NULLIF(BTRIM(COALESCE(op.payment_id, '')), '') IS NOT NULL");
    expect(expireFunction).toContain("NULLIF(BTRIM(COALESCE(p.external_id, '')), '') IS NOT NULL");
  });

  it("allows only webhook/system controlled recovery from falha_pagamento to pago", () => {
    expect(transitionFunction).toContain(
      "(v_current = 'falha_pagamento' AND _next_status IN ('aguardando_pagamento', 'pago', 'cancelado'))",
    );
    expect(recoveryBlock).toContain("_actor_type NOT IN ('webhook', 'system')");
    expect(recoveryBlock).toContain("'FORBIDDEN_ACTOR'");
    expect(recoveryBlock).toContain("v_has_approved_mercado_pago_payment");
    expect(recoveryBlock).toContain("'PAYMENT_APPROVAL_REQUIRED'");
    expect(recoveryBlock).not.toContain("_actor_type = 'restaurant'");
    expect(recoveryBlock).not.toContain("_actor_type = 'customer'");
    expect(recoveryBlock).not.toContain("_actor_type = 'courier'");
    expect(recoveryBlock).not.toContain("_actor_type = 'admin'");
  });

  it("requires approved local Mercado Pago online evidence for recovery", () => {
    expect(recoveryBlock).toContain("FROM public.order_payment op");
    expect(recoveryBlock).toContain("op.order_id = _order_id");
    expect(recoveryBlock).toContain("op.provider = 'mercado_pago'");
    expect(recoveryBlock).toContain("op.status = 'APPROVED'");
    expect(recoveryBlock).toContain("op.payment_method IN ('pix', 'credit_card')");
    expect(recoveryBlock).toContain("NULLIF(BTRIM(COALESCE(op.payment_id, '')), '') IS NOT NULL");
    expect(recoveryBlock).toContain("FROM public.payments p");
    expect(recoveryBlock).toContain("p.order_id = _order_id");
    expect(recoveryBlock).toContain("p.provider = 'mercado_pago'");
    expect(recoveryBlock).toContain("p.status = 'approved'");
    expect(recoveryBlock).toContain("p.method IN ('pix', 'card', 'credit_card')");
    expect(recoveryBlock).toContain("NULLIF(BTRIM(COALESCE(p.external_id, '')), '') IS NOT NULL");
  });

  it("does not authorize recovery from payment evidence tied to another order", () => {
    expect(recoveryBlock).toContain("op.order_id = _order_id");
    expect(recoveryBlock).toContain("p.order_id = _order_id");
    expect(recoveryBlock).not.toContain("op.order_id IS NOT NULL");
    expect(recoveryBlock).not.toContain("p.order_id IS NOT NULL");
  });

  it("does not authorize recovery with approved records missing gateway ids", () => {
    expect(recoveryBlock).toContain("NULLIF(BTRIM(COALESCE(op.payment_id, '')), '') IS NOT NULL");
    expect(recoveryBlock).toContain("NULLIF(BTRIM(COALESCE(p.external_id, '')), '') IS NOT NULL");
    expect(recoveryBlock).not.toContain("op.status = 'APPROVED' AND op.payment_id IS NULL");
    expect(recoveryBlock).not.toContain("p.status = 'approved' AND p.external_id IS NULL");
  });

  it("does not authorize recovery from cash or offline payment methods", () => {
    expect(recoveryBlock).toContain("op.payment_method IN ('pix', 'credit_card')");
    expect(recoveryBlock).toContain("p.method IN ('pix', 'card', 'credit_card')");
    expect(recoveryBlock).not.toContain("'cash'");
    expect(recoveryBlock).not.toContain("'card_on_delivery'");
    expect(recoveryBlock).not.toContain("'debit_card'");
    expect(recoveryBlock).not.toContain("'meal_voucher'");
  });

  it("does not add cancelado to pago recovery", () => {
    expect(normalizedSql).not.toContain("(v_current = 'cancelado' AND _next_status IN ('pago'");
    expect(normalizedSql).not.toContain("v_current = 'cancelado' AND _next_status = 'pago'");
  });

  it("preserves the online cancellation refund guard", () => {
    expect(cancelGuardBlock).toContain("_next_status = 'cancelado'");
    expect(cancelGuardBlock).toContain("op.provider = 'mercado_pago'");
    expect(cancelGuardBlock).toContain("op.status = 'APPROVED'");
    expect(cancelGuardBlock).toContain("op.payment_method IN ('pix', 'credit_card')");
    expect(cancelGuardBlock).toContain(
      "NULLIF(BTRIM(COALESCE(op.payment_id, '')), '') IS NOT NULL",
    );
    expect(cancelGuardBlock).toContain("'ONLINE_PAYMENT_REFUND_REQUIRED'");
  });

  it("preserves the audited transition and actor matrices around the new recovery edge", () => {
    for (const transitionRule of currentTransitionRules) {
      expect(normalizedSql).toContain(transitionRule);
    }

    for (const actorRule of currentActorRules) {
      expect(migrationSql).toContain(actorRule);
    }
  });

  it("preserves auth, ownership, delivery, revenue, history, and JSON return behavior", () => {
    expect(migrationSql).toContain("v_auth_uid uuid := auth.uid();");
    expect(migrationSql).toContain(
      "v_is_service_role boolean := COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role';",
    );
    expect(migrationSql).toContain("IF NOT v_is_service_role THEN");
    expect(migrationSql).toContain("_actor_type IN ('system', 'webhook')");
    expect(migrationSql).toContain("public.has_role(v_auth_uid, 'admin'::public.app_role)");
    expect(migrationSql).toContain("AND r.owner_id = v_auth_uid");
    expect(migrationSql).toContain("v_customer_id IS DISTINCT FROM v_auth_uid");
    expect(migrationSql).toContain("JOIN public.delivery_drivers dd ON dd.id = da.driver_id");
    expect(migrationSql).toContain("'DELIVERY_ASSIGNMENT_REQUIRED'");
    expect(migrationSql).toContain("'DELIVERY_ASSIGNMENT_FLOW_REQUIRED'");
    expect(migrationSql).toContain("UPDATE public.order_pricing_snapshot");
    expect(migrationSql).toContain("realized_platform_revenue = CASE");
    expect(migrationSql).toContain("INSERT INTO public.order_status_history");
    expect(migrationSql).toContain("'ok', true");
    expect(migrationSql).toContain("'history_id', v_history_id");
  });

  it("does not refund or mutate payment/ledger tables inside order_apply_transition", () => {
    expect(normalizedExecutableLower).not.toContain("mp-payment-intent");
    expect(normalizedExecutableLower).not.toContain("update public.order_payment");
    expect(normalizedExecutableLower).not.toContain("update public.payments");
    expect(normalizedExecutableLower).not.toContain("insert into public.financial_ledger");
  });

  it("preserves SECURITY DEFINER, search_path, and existing grants by omission", () => {
    expect(expireFunction).toContain("SECURITY DEFINER");
    expect(expireFunction).toContain("SET search_path TO 'public'");
    expect(transitionFunction).toContain("SECURITY DEFINER");
    expect(transitionFunction).toContain("SET search_path = public");
    expect(normalizedLower).not.toContain("owner to");
    expect(normalizedLower).not.toContain("grant execute");
    expect(normalizedLower).not.toContain("revoke execute");
  });

  it("keeps the Mercado Pago webhook on transitionOrder with actor webhook for APPROVED to pago", () => {
    expect(webhookSource).toContain('APPROVED: "pago"');
    expect(webhookSource).toContain("const tr = await transitionOrder({");
    expect(webhookSource).toContain("to: targetStatus");
    expect(webhookSource).toContain('actorType: "webhook"');
    expect(webhookSource).toContain('service: "mp-webhook"');
    expect(transitionHelperSource).toContain('sb.rpc("order_apply_transition"');
    expect(transitionHelperSource).not.toContain('.from("orders").update');
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculatePartnerGrowthVariation,
  countsAsPartnerGrowthRealizedSale,
  normalizePartnerGrowthDashboard,
  normalizePartnerGrowthPriorityAlerts,
  sortPartnerGrowthTasks,
  type PartnerGrowthTask,
} from "./partner-growth";
import {
  resolvePartnerGrowthAccess,
  type PartnerGrowthAssignment,
} from "./partner-growth-access";

const routeSource = readFileSync("src/routes/partner-growth.tsx", "utf8");
const libSource = readFileSync("src/lib/partner-growth.ts", "utf8");
const rootSource = readFileSync("src/routes/__root.tsx", "utf8");
const dashboardMigration = readFileSync(
  "supabase/migrations/20260824124834_partner_growth_dashboard_minimal.sql",
  "utf8",
);
const priorityAlertsMigration = readFileSync(
  "supabase/migrations/20260824152520_partner_growth_exception_alerts.sql",
  "utf8",
);
const manualTasksMigration = readFileSync(
  "supabase/migrations/20260824165345_partner_growth_manual_tasks.sql",
  "utf8",
);
const manualTasksHardeningMigration = readFileSync(
  "supabase/migrations/20260824183215_partner_growth_tasks_hardening.sql",
  "utf8",
);

const assignment = (overrides: Partial<PartnerGrowthAssignment> = {}): PartnerGrowthAssignment => ({
  id: "assignment-1",
  restaurantId: "restaurant-a",
  active: true,
  restaurant: { id: "restaurant-a", name: "Restaurante A" },
  ...overrides,
});

describe("PG-1B partner growth route guard", () => {
  it("redirects unauthenticated users to the partner auth login", () => {
    expect(routeSource).toContain('createFileRoute("/partner-growth")');
    expect(routeSource).toContain("supabase.auth.getUser()");
    expect(routeSource).toContain('to: "/auth"');
  });

  it("denies partner and admin roles without treating them as growth", () => {
    expect(
      resolvePartnerGrowthAccess({
        userId: "partner-user",
        roles: ["partner"],
        assignments: [assignment()],
      }),
    ).toBe("forbidden");
    expect(
      resolvePartnerGrowthAccess({
        userId: "admin-user",
        roles: ["admin"],
        assignments: [assignment()],
      }),
    ).toBe("forbidden");
  });

  it("requires at least one active assignment for partner_growth users", () => {
    expect(
      resolvePartnerGrowthAccess({
        userId: "growth-user",
        roles: ["partner_growth"],
        assignments: [],
      }),
    ).toBe("no_active_assignment");
    expect(
      resolvePartnerGrowthAccess({
        userId: "growth-user",
        roles: ["partner_growth"],
        assignments: [assignment({ active: false })],
      }),
    ).toBe("no_active_assignment");
  });

  it("allows growth users only when an active assignment exists", () => {
    expect(
      resolvePartnerGrowthAccess({
        userId: "growth-user",
        roles: ["partner_growth"],
        assignments: [assignment({ active: false }), assignment({ id: "assignment-2" })],
      }),
    ).toBe("allowed");
  });

  it("loads only the current user's own role and assignment wallet", () => {
    expect(libSource).toContain('.from("user_roles")');
    expect(libSource).toContain('.from("partner_growth_assignments" as any)');
    expect(libSource).toContain('.select("id, restaurant_id, active, restaurants(id, name)")');
    expect(libSource).toContain('.eq("user_id", userId)');
    expect(libSource).not.toContain("service_role");
    expect(libSource).not.toContain("accounts_payable");
    expect(libSource).not.toContain("accounts_receivable");
    expect(libSource).not.toContain("payments");
  });

  it("keeps growth outside partner/admin dashboards and restaurant onboarding", () => {
    expect(routeSource).not.toContain('createFileRoute("/_authenticated")');
    expect(routeSource).not.toContain('createFileRoute("/admin")');
    expect(routeSource).not.toContain("RestaurantProvider");
    expect(routeSource).not.toContain("OwnerOnboarding");
    expect(rootSource).toContain('"partner-growth"');
    expect(rootSource).toContain("isPartnerGrowthArea");
    expect(rootSource).toContain("<Outlet />");
  });

  it("renders Partner Growth without campaign, Benefits, Assist, or automation scope", () => {
    expect(routeSource).toContain("Partner Growth");
    expect(routeSource).toContain("Carteira");
    expect(routeSource).not.toContain("campanha");
    expect(routeSource).not.toContain("KPI");
    expect(routeSource).not.toContain("Benefits");
    expect(routeSource).not.toContain("Localix Assist");
    expect(routeSource).not.toContain("cupom");
    expect(routeSource).not.toContain("automacao");
  });
});

describe("PG-2A partner growth dashboard", () => {
  it("loads the dashboard through the dedicated aggregate RPC only", () => {
    expect(libSource).toContain('supabase.rpc("get_partner_growth_dashboard" as any)');
    expect(libSource).toContain('supabase.rpc("get_partner_growth_priority_alerts" as any)');
    expect(libSource).not.toContain('.from("orders")');
    expect(libSource).not.toContain('.from("customers")');
    expect(libSource).not.toContain("service_role");
  });

  it("creates a minimal SECURITY DEFINER aggregate RPC with safe grants", () => {
    expect(dashboardMigration).toContain("CREATE OR REPLACE FUNCTION public.get_partner_growth_dashboard");
    expect(dashboardMigration).toContain("RETURNS jsonb");
    expect(dashboardMigration).toContain("SECURITY DEFINER");
    expect(dashboardMigration).toContain("SET search_path = pg_catalog, public");
    expect(dashboardMigration).toContain("v_user_id uuid := auth.uid()");
    expect(dashboardMigration).toContain("IF v_user_id IS NULL");
    expect(dashboardMigration).toContain(
      "NOT private.has_role(v_user_id, 'partner_growth'::public.app_role)",
    );
    expect(dashboardMigration).toContain(
      "REVOKE ALL ON FUNCTION public.get_partner_growth_dashboard(timestamptz) FROM PUBLIC, anon, authenticated, service_role",
    );
    expect(dashboardMigration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_partner_growth_dashboard(timestamptz) TO authenticated",
    );
    expect(dashboardMigration).not.toContain(
      "GRANT EXECUTE ON FUNCTION public.get_partner_growth_dashboard(timestamptz) TO anon",
    );
    expect(dashboardMigration).not.toContain(
      "GRANT EXECUTE ON FUNCTION public.get_partner_growth_dashboard(timestamptz) TO service_role",
    );
    expect(dashboardMigration).not.toContain("GRANT SELECT ON public.orders TO authenticated");
    expect(dashboardMigration).not.toContain("GRANT SELECT ON public.customers TO authenticated");
  });

  it("keeps the order metrics projection unambiguous", () => {
    const orderMetricsSql = dashboardMigration.match(/order_metrics AS \([\s\S]*?\),\n  customer_metrics/)?.[0] ?? "";
    expect(orderMetricsSql.match(/AS last_realized_sale_at/g) ?? []).toHaveLength(1);
  });

  it("isolates Growth A and Growth B by the authenticated user's active wallet", () => {
    expect(dashboardMigration).toContain("WHERE pga.user_id = v_user_id");
    expect(dashboardMigration).toContain("AND pga.active = true");
    expect(dashboardMigration).toContain("AND private.has_partner_growth_restaurant(r.id)");
    expect(dashboardMigration).toContain("JOIN assigned_restaurants ar");
    expect(dashboardMigration).toContain("ON ar.restaurant_id = o.restaurant_id");
  });

  it("does not trust a restaurant_id parameter from the frontend", () => {
    const signature = dashboardMigration.match(
      /CREATE OR REPLACE FUNCTION public\.get_partner_growth_dashboard\([\s\S]*?\)/,
    )?.[0];
    expect(signature).toContain("_as_of timestamptz");
    expect(signature).not.toContain("_restaurant_id");
  });

  it("counts only entregue and concluido as realized sales", () => {
    expect(dashboardMigration).toContain("o.status IN ('entregue', 'concluido')");
    expect(dashboardMigration).not.toContain("status <> 'cancelado'");
    expect(dashboardMigration).not.toContain("status != 'cancelado'");

    for (const status of ["entregue", "concluido"]) {
      expect(countsAsPartnerGrowthRealizedSale(status)).toBe(true);
    }

    for (const status of ["pago", "falha_pagamento", "cancelado", "reembolsado", "chargeback"]) {
      expect(countsAsPartnerGrowthRealizedSale(status)).toBe(false);
    }
  });

  it("implements recurring, inactive 30+, and no-sale 7d segmentation", () => {
    expect(dashboardMigration).toContain("WHERE cs.realized_sales >= 2");
    expect(dashboardMigration).toContain("cs.last_realized_sale_at < (_as_of - interval '30 days')");
    expect(dashboardMigration).toContain("last_realized_sale_at < (_as_of - interval '7 days')");
    expect(dashboardMigration).not.toContain("VIP");
    expect(dashboardMigration).not.toContain("risco");
  });

  it("returns only aggregate fields and no customer PII", () => {
    const returnedJson = dashboardMigration.match(/SELECT jsonb_build_object\([\s\S]*?INTO v_dashboard;/)?.[0] ?? "";

    expect(returnedJson).toContain("'summary'");
    expect(returnedJson).toContain("'restaurants'");
    expect(returnedJson).toContain("'restaurant_id'");
    expect(returnedJson).toContain("'name'");
    expect(returnedJson).toContain("'current_period_orders'");
    expect(returnedJson).toContain("'previous_period_orders'");
    expect(returnedJson).toContain("'variation_percent'");
    expect(returnedJson).toContain("'last_realized_sale_at'");
    expect(returnedJson).toContain("'unique_customers_with_realized_sale'");
    expect(returnedJson).toContain("'recurring_customers'");
    expect(returnedJson).toContain("'inactive_30d_customers'");
    expect(returnedJson).not.toContain("customer_name");
    expect(returnedJson).not.toContain("customer_phone");
    expect(returnedJson).not.toContain("phone");
    expect(returnedJson).not.toContain("email");
    expect(returnedJson).not.toContain("address");
    expect(returnedJson).not.toContain("payment");
  });

  it("normalizes empty wallet and calculated variations", () => {
    expect(calculatePartnerGrowthVariation(10, 5)).toBe(100);
    expect(calculatePartnerGrowthVariation(5, 10)).toBe(-50);
    expect(calculatePartnerGrowthVariation(0, 0)).toBe(0);
    expect(calculatePartnerGrowthVariation(3, 0)).toBeNull();

    const dashboard = normalizePartnerGrowthDashboard({
      period: {
        current_start: "2026-08-01T00:00:00Z",
        current_end: "2026-08-24T12:00:00Z",
        previous_start: "2026-07-08T12:00:00Z",
        previous_end: "2026-08-01T00:00:00Z",
      },
      summary: {
        partners_count: 0,
        current_month_orders: 0,
        previous_period_orders: 0,
        variation_percent: 0,
        partners_without_sale_7d: 0,
        customers_with_realized_sale: 0,
        recurring_customers: 0,
        inactive_30d_customers: 0,
      },
      restaurants: [],
    });

    expect(dashboard.summary.partnersCount).toBe(0);
    expect(dashboard.restaurants).toEqual([]);
  });

  it("renders minimal cards, table columns, loading, empty wallet, and controlled error states", () => {
    expect(routeSource).toContain("Carregando");
    expect(routeSource).toContain("Sem carteira");
    expect(routeSource).toContain("Erro controlado");
    expect(routeSource).toContain("Parceiros ativos");
    expect(routeSource).toContain("Pedidos no mes");
    expect(routeSource).toContain("Clientes com compra");
    expect(routeSource).toContain("Clientes recorrentes");
    expect(routeSource).toContain("Inativos 30+");
    expect(routeSource).toContain("Sem venda 7 dias");
    expect(routeSource).toContain("Ultima venda");
  });
});

describe("PG-2C1 partner growth manual tasks", () => {
  it("creates only the manual task table with minimal non-financial fields", () => {
    expect(manualTasksMigration).toContain("CREATE TABLE IF NOT EXISTS public.partner_growth_tasks");
    for (const column of [
      "id uuid PRIMARY KEY DEFAULT gen_random_uuid()",
      "restaurant_id uuid NOT NULL REFERENCES public.restaurants(id)",
      "assigned_to uuid NOT NULL REFERENCES auth.users(id)",
      "created_by uuid NOT NULL REFERENCES auth.users(id)",
      "source_signal text",
      "title text NOT NULL",
      "notes text",
      "priority text NOT NULL",
      "status text NOT NULL DEFAULT 'PENDENTE'",
      "due_at timestamptz",
      "created_at timestamptz NOT NULL DEFAULT now()",
      "updated_at timestamptz NOT NULL DEFAULT now()",
    ]) {
      expect(manualTasksMigration).toContain(column);
    }

    for (const forbidden of [
      "customer_name",
      "customer_phone",
      "customer_email",
      "address",
      "payment",
      "mercado",
      "benefit",
      "payout",
      "ledger",
      "campaign",
      "automation",
    ]) {
      expect(manualTasksMigration.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("limits source signals, priorities, statuses, title, and notes", () => {
    expect(manualTasksMigration).toContain(
      "source_signal IS NULL OR source_signal IN",
    );
    expect(manualTasksMigration).toContain("'SEM_VENDA_7D'");
    expect(manualTasksMigration).toContain("'QUEDA_PEDIDOS'");
    expect(manualTasksMigration).toContain("'CLIENTES_INATIVOS_30D'");
    expect(manualTasksMigration).toContain("'BOA_EVOLUCAO'");
    expect(manualTasksMigration).not.toContain("'BAIXA_RECORRENCIA'");
    expect(manualTasksMigration).toContain("priority IN ('ALTA', 'MEDIA', 'BAIXA')");
    expect(manualTasksMigration).toContain(
      "status IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'DESCARTADA')",
    );
    expect(manualTasksMigration).toContain("char_length(btrim(title)) BETWEEN 1 AND 160");
    expect(manualTasksMigration).toContain("notes IS NULL OR char_length(notes) <= 1000");
  });

  it("adds focused indexes for wallet, restaurant, and open due tasks", () => {
    expect(manualTasksMigration).toContain("partner_growth_tasks_assigned_status_idx");
    expect(manualTasksMigration).toContain("ON public.partner_growth_tasks (assigned_to, status)");
    expect(manualTasksMigration).toContain("partner_growth_tasks_restaurant_status_idx");
    expect(manualTasksMigration).toContain("ON public.partner_growth_tasks (restaurant_id, status)");
    expect(manualTasksMigration).toContain("partner_growth_tasks_open_due_idx");
    expect(manualTasksMigration).toContain("WHERE status IN ('PENDENTE', 'EM_ANDAMENTO')");
  });

  it("enforces RLS through the authenticated growth wallet and keeps admin management separate", () => {
    expect(manualTasksMigration).toContain(
      "ALTER TABLE public.partner_growth_tasks ENABLE ROW LEVEL SECURITY",
    );
    expect(manualTasksMigration).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_growth_tasks TO authenticated",
    );
    expect(manualTasksMigration).toContain("GRANT ALL ON public.partner_growth_tasks TO service_role");
    expect(manualTasksMigration).toContain("assigned_to = auth.uid()");
    expect(manualTasksMigration).toContain("created_by = auth.uid()");
    expect(manualTasksMigration).toContain("private.has_partner_growth_restaurant(restaurant_id)");
    expect(manualTasksMigration).toContain('"partner growth tasks admin manage"');
    expect(manualTasksMigration).toContain("public.has_role(auth.uid(), 'admin'::public.app_role)");
    expect(manualTasksMigration).not.toContain("FOR DELETE TO authenticated");
    expect(manualTasksMigration).not.toContain("USING (true)");
  });

  it("blocks cross-tenant reassignment and invalid status reopening in the trigger", () => {
    expect(manualTasksMigration).toContain("CREATE OR REPLACE FUNCTION public.partner_growth_tasks_guard");
    expect(manualTasksMigration).toContain("SECURITY DEFINER");
    expect(manualTasksMigration).toContain("SET search_path = pg_catalog, public");
    expect(manualTasksMigration).toContain("NEW.assigned_to IS DISTINCT FROM OLD.assigned_to");
    expect(manualTasksMigration).toContain("NEW.created_by IS DISTINCT FROM OLD.created_by");
    expect(manualTasksMigration).toContain("RAISE EXCEPTION 'Forbidden identity change'");
    expect(manualTasksMigration).toContain("OLD.status = 'PENDENTE'");
    expect(manualTasksMigration).toContain("NEW.status IN ('EM_ANDAMENTO', 'CONCLUIDA', 'DESCARTADA')");
    expect(manualTasksMigration).toContain("OLD.status = 'EM_ANDAMENTO'");
    expect(manualTasksMigration).toContain("NEW.status IN ('CONCLUIDA', 'DESCARTADA')");
    expect(manualTasksMigration).toContain("RAISE EXCEPTION 'Invalid task status transition'");
  });

  it("loads, creates, and updates tasks without service_role or direct order/customer reads", () => {
    expect(libSource).toContain('.from("partner_growth_tasks" as any)');
    expect(libSource).toContain("loadPartnerGrowthTasks");
    expect(libSource).toContain("createPartnerGrowthTask");
    expect(libSource).toContain("updatePartnerGrowthTaskStatus");
    expect(libSource).toContain("assigned_to: userId");
    expect(libSource).toContain("created_by: userId");
    expect(libSource).toContain('status: "PENDENTE"');
    expect(libSource).toContain(".update({ status })");
    expect(libSource).not.toContain(".from(\"orders\")");
    expect(libSource).not.toContain(".from(\"customers\")");
    expect(libSource).not.toContain("service_role");
  });

  it("renders manual creation, alert-origin creation, transitions, and duplicate warning", () => {
    expect(routeSource).toContain("Nova tarefa");
    expect(routeSource).toContain("Criar tarefa");
    expect(routeSource).toContain("Minhas tarefas");
    expect(routeSource).toContain("Confirmar e salvar");
    expect(routeSource).toContain("Tarefa aberta existente");
    expect(routeSource).toContain("Ja existe uma tarefa aberta para este restaurante e sinal");
    expect(routeSource).toContain("Nao inclua dados pessoais de clientes nas observacoes");
    expect(routeSource).toContain("sourceSignal: null");
    expect(routeSource).toContain("sourceSignal: alert.signal");
    expect(routeSource).toContain("EM_ANDAMENTO");
    expect(routeSource).toContain("CONCLUIDA");
    expect(routeSource).toContain("DESCARTADA");
    expect(routeSource).not.toContain("WhatsApp");
    expect(routeSource).not.toContain("Enviar email");
    expect(routeSource).not.toContain("CRM");
    expect(routeSource).not.toContain("automacao");
  });

  it("sorts open tasks before terminal tasks, then overdue, priority, due date, and creation", () => {
    const baseTask = {
      id: "task",
      restaurantId: "restaurant-a",
      restaurantName: "Restaurante A",
      assignedTo: "growth-user",
      createdBy: "growth-user",
      sourceSignal: null,
      title: "Tarefa",
      notes: null,
      priority: "BAIXA",
      status: "PENDENTE",
      dueAt: null,
      createdAt: "2026-08-24T12:00:00.000Z",
      updatedAt: "2026-08-24T12:00:00.000Z",
    } satisfies PartnerGrowthTask;

    const sorted = sortPartnerGrowthTasks(
      [
        { ...baseTask, id: "done", status: "CONCLUIDA", priority: "ALTA" },
        { ...baseTask, id: "later", priority: "ALTA", dueAt: "2026-08-26T12:00:00.000Z" },
        { ...baseTask, id: "overdue-low", dueAt: "2026-08-20T12:00:00.000Z" },
        {
          ...baseTask,
          id: "overdue-high",
          priority: "ALTA",
          dueAt: "2026-08-20T12:00:00.000Z",
        },
      ],
      new Date("2026-08-24T12:00:00.000Z"),
    );

    expect(sorted.map((task) => task.id)).toEqual([
      "overdue-high",
      "overdue-low",
      "later",
      "done",
    ]);
  });
});

describe("PG-2C1 partner growth tasks hardening", () => {
  it("uses an incremental migration that only hardens task timestamps and grants", () => {
    expect(manualTasksHardeningMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.partner_growth_tasks_guard()",
    );
    expect(manualTasksHardeningMigration).toContain("REVOKE ALL ON TABLE public.partner_growth_tasks");
    expect(manualTasksHardeningMigration).toContain(
      "REVOKE ALL ON FUNCTION public.partner_growth_tasks_guard()",
    );
    expect(manualTasksHardeningMigration).not.toContain("CREATE TABLE");
    expect(manualTasksHardeningMigration).not.toContain("CREATE POLICY");
    expect(manualTasksHardeningMigration).not.toContain("DROP TABLE");
    expect(manualTasksHardeningMigration).not.toContain("DELETE FROM");
    expect(manualTasksHardeningMigration).not.toContain("INSERT INTO public.partner_growth_tasks");
    expect(manualTasksHardeningMigration).not.toContain("get_partner_growth_dashboard");
    expect(manualTasksHardeningMigration).not.toContain("get_partner_growth_priority_alerts");
    expect(manualTasksHardeningMigration.toLowerCase()).not.toContain("payment");
    expect(manualTasksHardeningMigration.toLowerCase()).not.toContain("benefit");
  });

  it("blocks created_at changes server-side while preserving updated_at behavior", () => {
    expect(manualTasksHardeningMigration).toContain(
      "IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN",
    );
    expect(manualTasksHardeningMigration).toContain("RAISE EXCEPTION 'created_at is immutable'");
    expect(manualTasksHardeningMigration).toContain("NEW.updated_at := now()");
    expect(manualTasksHardeningMigration).toContain("RETURN NEW");

    const immutableCheckIndex = manualTasksHardeningMigration.indexOf(
      "IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN",
    );
    const adminCheckIndex = manualTasksHardeningMigration.indexOf("IF NOT v_is_admin THEN");
    expect(immutableCheckIndex).toBeGreaterThan(-1);
    expect(adminCheckIndex).toBeGreaterThan(-1);
    expect(immutableCheckIndex).toBeLessThan(adminCheckIndex);
  });

  it("keeps insert defaults for created_at and updated_at in the base table", () => {
    expect(manualTasksMigration).toContain("created_at timestamptz NOT NULL DEFAULT now()");
    expect(manualTasksMigration).toContain("updated_at timestamptz NOT NULL DEFAULT now()");
    expect(manualTasksHardeningMigration).not.toContain("ALTER COLUMN created_at DROP DEFAULT");
    expect(manualTasksHardeningMigration).not.toContain("ALTER COLUMN updated_at DROP DEFAULT");
  });

  it("removes broad table grants and grants only SELECT, INSERT, UPDATE to authenticated", () => {
    expect(manualTasksHardeningMigration).toContain(
      "REVOKE ALL ON TABLE public.partner_growth_tasks FROM PUBLIC, anon, authenticated, service_role",
    );
    expect(manualTasksHardeningMigration).toContain(
      "GRANT SELECT, INSERT, UPDATE ON TABLE public.partner_growth_tasks TO authenticated",
    );
    expect(manualTasksHardeningMigration).not.toContain("GRANT DELETE");
    expect(manualTasksHardeningMigration).not.toContain("TO anon");
    expect(manualTasksHardeningMigration).not.toContain("TO PUBLIC");
    expect(manualTasksHardeningMigration).not.toContain("TO service_role");
  });

  it("revokes execute on the PG-2C1 trigger helper from public-like roles", () => {
    expect(manualTasksHardeningMigration).toContain(
      "REVOKE ALL ON FUNCTION public.partner_growth_tasks_guard() FROM PUBLIC, anon, authenticated, service_role",
    );
    expect(manualTasksHardeningMigration).not.toContain(
      "GRANT EXECUTE ON FUNCTION public.partner_growth_tasks_guard()",
    );
  });

  it("preserves RLS access model and Growth DELETE blocking through policies", () => {
    expect(manualTasksMigration).toContain(
      "ALTER TABLE public.partner_growth_tasks ENABLE ROW LEVEL SECURITY",
    );
    expect(manualTasksMigration).toContain('"partner growth tasks own wallet select"');
    expect(manualTasksMigration).toContain('"partner growth tasks own wallet insert"');
    expect(manualTasksMigration).toContain('"partner growth tasks own wallet update"');
    expect(manualTasksMigration).toContain("private.has_partner_growth_restaurant(restaurant_id)");
    expect(manualTasksMigration).not.toContain("FOR DELETE TO authenticated");
    expect(manualTasksHardeningMigration).not.toContain("CREATE POLICY");
    expect(manualTasksHardeningMigration).not.toContain("DROP POLICY");
  });
});

describe("PG-2B partner growth priority alerts", () => {
  it("creates a dedicated alert RPC without changing the PG-2A dashboard contract", () => {
    expect(priorityAlertsMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.get_partner_growth_priority_alerts",
    );
    expect(priorityAlertsMigration).toContain("RETURNS jsonb");
    expect(priorityAlertsMigration).toContain("SECURITY DEFINER");
    expect(priorityAlertsMigration).toContain("SET search_path = pg_catalog, public");
    expect(priorityAlertsMigration).toContain("v_user_id uuid := auth.uid()");
    expect(priorityAlertsMigration).toContain(
      "NOT private.has_role(v_user_id, 'partner_growth'::public.app_role)",
    );
    expect(priorityAlertsMigration).toContain(
      "REVOKE ALL ON FUNCTION public.get_partner_growth_priority_alerts(timestamptz) FROM PUBLIC, anon, authenticated, service_role",
    );
    expect(priorityAlertsMigration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_partner_growth_priority_alerts(timestamptz) TO authenticated",
    );
    expect(dashboardMigration).not.toContain("get_partner_growth_priority_alerts");
  });

  it("isolates alerts to the authenticated user's active wallet", () => {
    expect(priorityAlertsMigration).toContain("WHERE pga.user_id = v_user_id");
    expect(priorityAlertsMigration).toContain("AND pga.active = true");
    expect(priorityAlertsMigration).toContain("AND private.has_partner_growth_restaurant(r.id)");
    expect(priorityAlertsMigration).toContain("JOIN assigned_restaurants ar");
    expect(priorityAlertsMigration).toContain("ON ar.restaurant_id = o.restaurant_id");
    expect(priorityAlertsMigration).not.toContain("_restaurant_id");
  });

  it("counts only entregue and concluido in alert metrics", () => {
    expect(priorityAlertsMigration).toContain("o.status IN ('entregue', 'concluido')");
    expect(priorityAlertsMigration).not.toContain("status <> 'cancelado'");
    expect(priorityAlertsMigration).not.toContain("status != 'cancelado'");

    for (const status of ["entregue", "concluido"]) {
      expect(countsAsPartnerGrowthRealizedSale(status)).toBe(true);
    }

    for (const status of ["pago", "falha_pagamento", "cancelado", "reembolsado", "chargeback"]) {
      expect(countsAsPartnerGrowthRealizedSale(status)).toBe(false);
    }
  });

  it("generates SEM_VENDA_7D as high priority for never sold or older than 7 days only", () => {
    expect(priorityAlertsMigration).toContain("'SEM_VENDA_7D'::text AS signal");
    expect(priorityAlertsMigration).toContain("'ALTA'::text AS priority");
    expect(priorityAlertsMigration).toContain("rr.last_realized_sale_at IS NULL");
    expect(priorityAlertsMigration).toContain(
      "rr.last_realized_sale_at < (_as_of - interval '7 days')",
    );
    expect(priorityAlertsMigration).not.toContain(
      "rr.last_realized_sale_at <= (_as_of - interval '7 days')",
    );
  });

  it("classifies order drops with valid previous period only", () => {
    expect(priorityAlertsMigration).toContain("'QUEDA_PEDIDOS'::text AS signal");
    expect(priorityAlertsMigration).toContain("rr.previous_period_orders > 0");
    expect(priorityAlertsMigration).toContain("WHEN rr.variation_percent <= -30 THEN 'ALTA'");
    expect(priorityAlertsMigration).toContain("ELSE 'MEDIA'");
    expect(priorityAlertsMigration).toContain("AND rr.variation_percent <= -15");
    expect(priorityAlertsMigration).not.toContain("previous_period_orders = 0");
  });

  it("does not alert for drops below 15 percent or previous period zero", () => {
    expect(calculatePartnerGrowthVariation(86, 100)).toBe(-14);
    expect(calculatePartnerGrowthVariation(80, 100)).toBe(-20);
    expect(calculatePartnerGrowthVariation(65, 100)).toBe(-35);
    expect(calculatePartnerGrowthVariation(3, 0)).toBeNull();
  });

  it("generates positive opportunity only with previous base and 20 percent growth", () => {
    expect(priorityAlertsMigration).toContain("'BOA_EVOLUCAO'::text AS signal");
    expect(priorityAlertsMigration).toContain("'OPORTUNIDADE'::text AS type");
    expect(priorityAlertsMigration).toContain("rr.previous_period_orders > 0");
    expect(priorityAlertsMigration).toContain("rr.variation_percent >= 20");
  });

  it("implements inactive 30d absolute thresholds and avoids fabricated low recurrence", () => {
    expect(priorityAlertsMigration).toContain("'CLIENTES_INATIVOS_30D'::text AS signal");
    expect(priorityAlertsMigration).toContain("cs.last_realized_sale_at < (_as_of - interval '30 days')");
    expect(priorityAlertsMigration).toContain("WHEN rr.inactive_30d_customers >= 5 THEN 'MEDIA'");
    expect(priorityAlertsMigration).toContain("ELSE 'BAIXA'");
    expect(priorityAlertsMigration).toContain("WHERE rr.inactive_30d_customers >= 1");
    expect(priorityAlertsMigration).not.toContain("'BAIXA_RECORRENCIA'::text AS signal");
  });

  it("returns only the priority alert contract and no customer PII", () => {
    const returnedJson =
      priorityAlertsMigration.match(/SELECT coalesce\([\s\S]*?RETURN jsonb_build_object/)?.[0] ??
      "";

    for (const key of [
      "'restaurantId'",
      "'restaurantName'",
      "'signal'",
      "'type'",
      "'priority'",
      "'reason'",
      "'suggestedAction'",
      "'metricValue'",
    ]) {
      expect(returnedJson).toContain(key);
    }

    for (const forbidden of [
      "customer_id",
      "customer_name",
      "customer_phone",
      "phone",
      "email",
      "address",
      "payment",
      "mercado",
      "benefit",
      "payout",
      "ledger",
    ]) {
      expect(returnedJson.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("orders alerts by high, medium, low, then opportunity deterministically", () => {
    expect(priorityAlertsMigration).toContain(
      "WHEN s.type = 'ALERTA' AND s.priority = 'ALTA' THEN 1",
    );
    expect(priorityAlertsMigration).toContain(
      "WHEN s.type = 'ALERTA' AND s.priority = 'MEDIA' THEN 2",
    );
    expect(priorityAlertsMigration).toContain(
      "WHEN s.type = 'ALERTA' AND s.priority = 'BAIXA' THEN 3",
    );
    expect(priorityAlertsMigration).toContain("ELSE 4");
    expect(priorityAlertsMigration).toContain("ORDER BY priority_rank, name, signal");
  });

  it("normalizes empty wallet and alert payloads without PII", () => {
    expect(normalizePartnerGrowthPriorityAlerts({ alerts: [] })).toEqual([]);
    expect(
      normalizePartnerGrowthPriorityAlerts({
        alerts: [
          {
            restaurantId: "r1",
            restaurantName: "Restaurante A",
            signal: "QUEDA_PEDIDOS",
            type: "ALERTA",
            priority: "ALTA",
            reason: "Pedidos realizados cairam 35% em relacao ao periodo anterior",
            suggestedAction: "Analisar causas da queda e oportunidades de recuperacao",
            metricValue: 35,
          },
        ],
      }),
    ).toEqual([
      {
        restaurantId: "r1",
        restaurantName: "Restaurante A",
        signal: "QUEDA_PEDIDOS",
        type: "ALERTA",
        priority: "ALTA",
        reason: "Pedidos realizados cairam 35% em relacao ao periodo anterior",
        suggestedAction: "Analisar causas da queda e oportunidades de recuperacao",
        metricValue: 35,
      },
    ]);
  });

  it("renders priority states without CRM, automation, campaign, or external actions", () => {
    expect(routeSource).toContain("Prioridades da carteira");
    expect(routeSource).toContain("Carteira sem alertas");
    expect(routeSource).toContain("Somente oportunidades");
    expect(routeSource).toContain("Nenhuma prioridade operacional no momento");
    expect(routeSource).toContain("Erro controlado");
    expect(routeSource).toContain("Alta");
    expect(routeSource).toContain("Media");
    expect(routeSource).toContain("Baixa");
    expect(routeSource).toContain("Oportunidade");
    expect(routeSource).not.toContain("WhatsApp");
    expect(routeSource).not.toContain("push");
    expect(routeSource).not.toContain("campanha");
    expect(routeSource).not.toContain("CRM");
  });
});

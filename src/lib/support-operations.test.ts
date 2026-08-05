import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canAccessSupportCategory, canViewAdminSupport } from "./support-admin";
import {
  DEFAULT_SUPPORT_SLA_SETTINGS,
  buildSupportReports,
  calculateSupportSla,
  renderQuickReply,
  sanitizeSupportText,
  suggestKnowledgeArticles,
} from "./support-operations";

const migration = "supabase/migrations/20260805150000_support_operations_sla_notifications.sql";
const finalMigration = "supabase/migrations/20260805160000_support_knowledge_category_scope_and_sla_cron.sql";
const adminKnowledgeRoute = "src/routes/admin.knowledge.tsx";
const internalBell = "src/components/admin/InternalNotificationsBell.tsx";

describe("support operations domain", () => {
  it("calculates first response and resolution SLA", () => {
    const sla = calculateSupportSla(
      {
        priority: "urgente",
        status: "em_analise",
        created_at: "2026-08-05T10:00:00.000Z",
        first_response_at: "2026-08-05T10:45:00.000Z",
        resolved_at: "2026-08-05T13:30:00.000Z",
      },
      DEFAULT_SUPPORT_SLA_SETTINGS,
      [],
      new Date("2026-08-05T14:00:00.000Z"),
    );
    expect(sla.firstResponseMet).toBe(true);
    expect(sla.resolutionMet).toBe(true);
    expect(sla.firstResponseMinutes).toBe(45);
    expect(sla.resolutionMinutes).toBe(210);
  });

  it("pauses resolution SLA while waiting for the customer", () => {
    const sla = calculateSupportSla(
      {
        priority: "urgente",
        status: "em_analise",
        created_at: "2026-08-05T10:00:00.000Z",
        first_response_at: "2026-08-05T10:30:00.000Z",
        resolved_at: "2026-08-05T14:30:00.000Z",
      },
      DEFAULT_SUPPORT_SLA_SETTINGS,
      [{ started_at: "2026-08-05T11:00:00.000Z", ended_at: "2026-08-05T12:00:00.000Z" }],
      new Date("2026-08-05T14:30:00.000Z"),
    );
    expect(sla.pausedMinutes).toBe(60);
    expect(sla.resolutionMinutes).toBe(210);
    expect(sla.resolutionMet).toBe(true);
  });

  it("renders quick replies with safe variables", () => {
    const rendered = renderQuickReply("Ola {{restaurant_name}}, chamado #{{ticket_number}} - {{agent_name}}", {
      restaurantName: "Padaria Central",
      ticketNumber: 1020,
      agentName: "Ana",
    });
    expect(rendered).toBe("Ola Padaria Central, chamado #1020 - Ana");
  });

  it("sanitizes unsafe content from quick replies", () => {
    expect(sanitizeSupportText("<img src=x onerror=alert(1)>Texto <b>ok</b>")).toBe("Texto ok");
  });

  it("suggests only published knowledge articles", () => {
    const result = suggestKnowledgeArticles("impressora pedido", [
      { id: "draft", title: "Impressora interna", content: "pedido", category: "impressao", published: false },
      { id: "published", title: "Configurar impressora", content: "pedidos nao imprimem", category: "impressao", published: true },
    ]);
    expect(result.map((article) => article.id)).toEqual(["published"]);
  });

  it("builds reports respecting filters and timezone", () => {
    const report = buildSupportReports(
      [
        {
          id: "a",
          ticket_number: 1001,
          restaurant_id: "r1",
          restaurant_name: "Alpha",
          subject: "Pedido",
          category: "pedido",
          priority: "media",
          status: "resolvido",
          assigned_to: "agent-1",
          assignee_label: "Ana",
          created_at: "2026-08-05T02:30:00.000Z",
          first_response_at: "2026-08-05T03:00:00.000Z",
          resolved_at: "2026-08-05T04:00:00.000Z",
          reopened_count: 1,
        },
        {
          id: "b",
          ticket_number: 1002,
          restaurant_id: "r2",
          restaurant_name: "Beta",
          subject: "Pagamento",
          category: "pagamentos",
          priority: "alta",
          status: "aberto",
          created_at: "2026-08-05T12:00:00.000Z",
        },
      ],
      DEFAULT_SUPPORT_SLA_SETTINGS,
      { from: "2026-08-04", to: "2026-08-04", category: "pedido" },
    );
    expect(report.totalTickets).toBe(1);
    expect(report.timezone).toBe("America/Sao_Paulo");
    expect(report.byPeriod["2026-08-04"]).toBe(1);
    expect(report.reopenRate).toBe(100);
  });

  it("keeps users without internal role out of support reports", () => {
    expect(canViewAdminSupport(["restaurant_owner"])).toBe(false);
  });

  it("limits support agents to explicitly allowed categories", () => {
    expect(canAccessSupportCategory("support_agent", ["pedido"], "pedido")).toBe(true);
    expect(canAccessSupportCategory("support_agent", ["pedido"], "pagamentos")).toBe(false);
  });

  it("treats an empty category list as no access for support agents", () => {
    expect(canAccessSupportCategory("support_agent", [], "pedido")).toBe(false);
  });

  it("lets admins and managers see every category", () => {
    expect(canAccessSupportCategory("admin", [], "pagamentos")).toBe(true);
    expect(canAccessSupportCategory("support_manager", [], "impressao")).toBe(true);
  });
});

describe("support final hardening migration contract", () => {
  const sql = readFileSync(finalMigration, "utf8");

  it("enforces category-scoped RLS for direct URL and manual calls", () => {
    expect(sql).toContain("public.can_access_support_category(auth.uid(), support_tickets.category)");
    expect(sql).toContain("public.can_access_support_category(auth.uid(), t.category)");
    expect(sql).toContain("AND _category = ANY(stm.allowed_categories)");
  });

  it("uses an explicit safe empty-list rule for agents", () => {
    expect(sql).toContain("COALESCE(stm.allowed_categories, '{}'::public.support_category[])");
    expect(sql).not.toContain("OR stm.allowed_categories = '{}'");
  });

  it("keeps only published and non-archived articles visible to restaurants", () => {
    expect(sql).toContain("(published = true AND archived = false)");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS archived boolean");
  });

  it("schedules SLA checks through pg_cron every five minutes", () => {
    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS pg_cron");
    expect(sql).toContain("support-sla-notifications-every-5-minutes");
    expect(sql).toContain("'*/5 * * * *'");
    expect(sql).toContain("SELECT public.run_support_sla_notifications_job();");
  });

  it("keeps repeated SLA runs idempotent through notified timestamps", () => {
    expect(sql).toContain("sla_first_response_notified_at IS NULL");
    expect(sql).toContain("sla_first_response_breached_notified_at IS NULL");
    expect(sql).toContain("sla_resolution_near_notified_at IS NULL");
    expect(sql).toContain("sla_resolution_breached_notified_at IS NULL");
  });

  it("creates near-due and breached SLA alerts", () => {
    expect(sql).toContain("SUPPORT_SLA_NEAR_DUE");
    expect(sql).toContain("SUPPORT_SLA_BREACHED");
  });
});

describe("support knowledge and internal notifications UI contract", () => {
  const route = readFileSync(adminKnowledgeRoute, "utf8");
  const bell = readFileSync(internalBell, "utf8");

  it("implements administrative CRUD for knowledge articles", () => {
    expect(route).toContain("createFileRoute(\"/admin/knowledge\")");
    expect(route).toContain("listKnowledgeArticlesAdmin");
    expect(route).toContain("saveKnowledgeArticleAdmin");
    expect(route).toContain("updateKnowledgeArticleStatusAdmin");
    expect(route).toContain("Arquivar");
  });

  it("renders internal notifications with links to the correct support ticket", () => {
    expect(bell).toContain("listInternalNotifications");
    expect(bell).toContain("markInternalNotificationRead");
    expect(bell).toContain("payload_json?.ticket_id");
    expect(bell).toContain("to=\"/admin/support/$ticketId\"");
  });
});

describe("support operations migration contract", () => {
  const sql = readFileSync(migration, "utf8");

  it("uses the existing notification queue for new tickets and messages", () => {
    expect(sql).toContain("public.notifications");
    expect(sql).toContain("SUPPORT_TICKET_CREATED");
    expect(sql).toContain("SUPPORT_MESSAGE_FROM_MERCHANT");
  });

  it("defines all internal support notification templates", () => {
    for (const code of [
      "SUPPORT_TICKET_URGENT",
      "SUPPORT_TICKET_ASSIGNED",
      "SUPPORT_TICKET_TRANSFERRED",
      "SUPPORT_SLA_NEAR_DUE",
      "SUPPORT_SLA_BREACHED",
      "SUPPORT_CUSTOMER_REPLIED",
      "SUPPORT_TICKET_REOPENED",
    ]) {
      expect(sql).toContain(code);
    }
  });

  it("stores configurable first-response and resolution SLA", () => {
    expect(sql).toContain("support_sla_settings");
    expect(sql).toContain("first_response_minutes");
    expect(sql).toContain("resolution_minutes");
    expect(sql).toContain("resolution_sla_due_at");
  });

  it("stores quick replies without unsafe html", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.support_quick_replies");
    expect(sql).toContain("CHECK (body !~* '<[^>]+>')");
  });

  it("keeps SLA notifications scheduled by a service-role function", () => {
    expect(sql).toContain("enqueue_support_sla_notifications");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.enqueue_support_sla_notifications(timestamptz) TO service_role");
  });
});

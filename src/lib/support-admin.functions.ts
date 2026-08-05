import { createServerFn } from "@tanstack/react-start";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertSupportInviteNotExpired,
  buildSupportMetrics,
  calculateSlaDueAt,
  canChangeSupportMemberRole,
  canManageSupportTeam,
  canAccessSupportCategory,
  canResolveTicket,
  canSetSupportMemberActive,
  canSupport,
  isManagedSupportRole,
  sortSupportTickets,
  type LegacySupportStatus,
  type ManagedSupportRole,
  type SupportCategory,
  type SupportPriority,
  type SupportRole,
  type SupportTicketListItem,
} from "@/lib/support-admin";
import {
  DEFAULT_SUPPORT_SLA_SETTINGS,
  buildSupportReports,
  parseSupportSlaSettings,
  sanitizeSupportText,
  serializeSupportSlaSettings,
  suggestKnowledgeArticles,
  type SupportSlaSettings,
} from "@/lib/support-operations";

const supportRoles: SupportRole[] = ["admin", "support_manager", "support_agent"];
const managedSupportRoles: ManagedSupportRole[] = ["support_manager", "support_agent"];
const prioritySchema = z.enum(["baixa", "media", "alta", "urgente"]);
const categorySchema = z.enum([
  "problema_tecnico",
  "pedido",
  "pagamentos",
  "cardapio",
  "builder",
  "impressao",
  "financeiro",
  "fidelidade",
  "ia",
  "sugestao",
  "outro",
]);
const statusSchema = z.enum(["aberto", "em_analise", "respondido", "resolvido", "fechado"]);

const filterSchema = z.object({
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  category: categorySchema.optional(),
  restaurantId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  unassigned: z.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
});

const reportFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  category: categorySchema.optional(),
  priority: prioritySchema.optional(),
  restaurantId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
});

const ticketIdSchema = z.object({ ticketId: z.string().uuid() });

async function assertSupportRole(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  const roles = (data ?? []).map((row) => String(row.role));
  const role = supportRoles.find((candidate) => roles.includes(candidate));
  if (!role) throw new Error("Forbidden");
  let allowedCategories: SupportCategory[] = [];
  if (role !== "admin") {
    const { data: member, error: memberError } = await (supabaseAdmin.from("support_team_members") as any)
      .select("active, role, allowed_categories")
      .eq("user_id", userId)
      .maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!member?.active || member.role !== role) throw new Error("Forbidden");
    allowedCategories = Array.isArray(member.allowed_categories) ? member.allowed_categories : [];
  }

  return { supabaseAdmin, role, roles, allowedCategories };
}

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((row) => String(row.role));
  if (!canManageSupportTeam(roles)) throw new Error("Forbidden");
  return { supabaseAdmin, roles };
}

async function auditSupportTicket(input: {
  ticketId: string;
  actorId: string;
  actorRole: SupportRole;
  action: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin.from("support_ticket_audit") as any).insert({
    ticket_id: input.ticketId,
    actor_id: input.actorId,
    actor_role: input.actorRole,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? {},
  });
}

async function auditSupportTeam(input: {
  actorId: string;
  action: string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin.from("support_team_audit") as any).insert({
    actor_id: input.actorId,
    target_user_id: input.targetUserId ?? null,
    target_email: input.targetEmail ?? null,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? {},
  });
}

function pickRestaurantName(row: any): string {
  const restaurant = Array.isArray(row.restaurants) ? row.restaurants[0] : row.restaurants;
  return restaurant?.name ?? "Estabelecimento";
}

function normalizeTicket(row: any, lastMessageBody: string | null, assigneeLabel: string | null): SupportTicketListItem {
  return {
    id: row.id,
    ticket_number: row.ticket_number,
    restaurant_id: row.restaurant_id,
    restaurant_name: pickRestaurantName(row),
    subject: row.subject,
    category: row.category as SupportCategory,
    priority: row.priority as SupportPriority,
    status: row.status as LegacySupportStatus,
    assigned_to: row.assigned_to ?? null,
    assignee_label: assigneeLabel,
    assigned_at: row.assigned_at ?? null,
    first_response_at: row.first_response_at ?? null,
    resolved_at: row.resolved_at ?? null,
    closed_at: row.closed_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_message_at: row.last_message_at,
    last_message_body: lastMessageBody,
    sla_due_at: row.sla_due_at ?? calculateSlaDueAt(row),
    tags: Array.isArray(row.tags) ? row.tags : [],
  };
}

function normalizeSlaSettings(row: any): SupportSlaSettings {
  const settings = parseSupportSlaSettings(row?.support_sla_settings ?? null);
  return {
    ...settings,
    timezone: row?.support_timezone || settings.timezone || DEFAULT_SUPPORT_SLA_SETTINGS.timezone,
  };
}

function assertCanAccessTicketCategory(input: { role: SupportRole; allowedCategories: SupportCategory[]; category: SupportCategory }) {
  if (!canAccessSupportCategory(input.role, input.allowedCategories, input.category)) {
    throw new Error("Forbidden");
  }
}

function applySupportCategoryScope(query: any, role: SupportRole, allowedCategories: SupportCategory[]) {
  if (role === "admin" || role === "support_manager") return query;
  return query.in("category", allowedCategories);
}

async function loadAssigneeLabels(supabaseAdmin: any, userIds: string[]) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return new Map<string, string>();

  const { data: members } = await (supabaseAdmin.from("support_team_members") as any)
    .select("user_id, name, email")
    .in("user_id", unique);
  const labels = new Map<string, string>();
  for (const member of members ?? []) {
    labels.set(member.user_id, member.name || member.email || member.user_id.slice(0, 8));
  }

  const pairs = await Promise.all(
    unique.filter((id) => !labels.has(id)).map(async (id) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      return [id, data?.user?.email ?? id.slice(0, 8)] as const;
    }),
  );
  for (const [id, label] of pairs) labels.set(id, label);
  return labels;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function appBaseUrl() {
  return process.env.APP_BASE_URL ?? process.env.URL ?? process.env.VITE_APP_BASE_URL ?? "http://localhost:5173";
}

export const getAdminSupportQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filterSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, role, allowedCategories } = await assertSupportRole(context.userId);
    if (role === "support_agent" && allowedCategories.length === 0) return { tickets: [], metrics: buildSupportMetrics([]) };

    let query = (supabaseAdmin.from("support_tickets") as any)
      .select("*, restaurants(id, name, slug)")
      .order("last_message_at", { ascending: false })
      .limit(500);
    query = applySupportCategoryScope(query, role, allowedCategories);

    if (data.status) query = query.eq("status", data.status);
    if (data.priority) query = query.eq("priority", data.priority);
    if (data.category) query = query.eq("category", data.category);
    if (data.restaurantId) query = query.eq("restaurant_id", data.restaurantId);
    if (data.assignedTo) query = query.eq("assigned_to", data.assignedTo);
    if (data.unassigned) query = query.is("assigned_to", null);
    if (data.from) query = query.gte("created_at", `${data.from}T00:00:00`);
    if (data.to) query = query.lte("created_at", `${data.to}T23:59:59.999`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((row: any) => row.id);
    const { data: messages } = await (supabaseAdmin.from("support_messages") as any)
      .select("ticket_id, body, created_at, internal_note")
      .in("ticket_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .eq("internal_note", false)
      .order("created_at", { ascending: false });

    const lastMessageByTicket = new Map<string, string | null>();
    for (const message of messages ?? []) {
      if (!lastMessageByTicket.has(message.ticket_id)) {
        lastMessageByTicket.set(message.ticket_id, message.body ?? null);
      }
    }

    const assigneeLabels = await loadAssigneeLabels(
      supabaseAdmin,
      (rows ?? []).map((row: any) => row.assigned_to).filter(Boolean),
    );

    let tickets = (rows ?? []).map((row: any) =>
      normalizeTicket(row, lastMessageByTicket.get(row.id) ?? null, row.assigned_to ? assigneeLabels.get(row.assigned_to) ?? null : null),
    );

    if (data.search?.trim()) {
      const term = data.search.trim().toLowerCase();
      tickets = tickets.filter(
        (ticket) =>
          String(ticket.ticket_number ?? "").includes(term) ||
          ticket.subject.toLowerCase().includes(term) ||
          ticket.restaurant_name.toLowerCase().includes(term),
      );
    }

    tickets = sortSupportTickets(tickets);
    return { tickets, metrics: buildSupportMetrics(tickets) };
  });

export const getAdminSupportReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reportFilterSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, role, allowedCategories } = await assertSupportRole(context.userId);
    if (!canSupport(role, "view_reports")) throw new Error("Forbidden");
    if (role === "support_agent" && allowedCategories.length === 0) {
      const settings = DEFAULT_SUPPORT_SLA_SETTINGS;
      return {
        settings,
        ruleDescription:
          "Primeira resposta: created_at ate first_response_at. Resolucao: created_at ate resolved_at/closed_at. O status respondido pausa a resolucao quando ha auditoria de status; prioridade normal corresponde ao enum media.",
        report: buildSupportReports([], settings, data, {}),
      };
    }

    const { data: settingsRow } = await (supabaseAdmin.from("platform_settings") as any)
      .select("support_timezone, support_sla_settings")
      .eq("id", true)
      .maybeSingle();
    const settings = normalizeSlaSettings(settingsRow);

    let query = (supabaseAdmin.from("support_tickets") as any)
      .select("*, restaurants(id, name, slug)")
      .order("created_at", { ascending: false })
      .limit(2000);
    query = applySupportCategoryScope(query, role, allowedCategories);
    if (data.from) query = query.gte("created_at", `${data.from}T00:00:00`);
    if (data.to) query = query.lte("created_at", `${data.to}T23:59:59.999`);
    if (data.category) query = query.eq("category", data.category);
    if (data.priority) query = query.eq("priority", data.priority);
    if (data.restaurantId) query = query.eq("restaurant_id", data.restaurantId);
    if (data.assignedTo) query = query.eq("assigned_to", data.assignedTo);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const assigneeLabels = await loadAssigneeLabels(
      supabaseAdmin,
      (rows ?? []).map((row: any) => row.assigned_to).filter(Boolean),
    );

    const ids = (rows ?? []).map((row: any) => row.id);
    const { data: audits } = await (supabaseAdmin.from("support_ticket_audit") as any)
      .select("ticket_id, before, after, created_at")
      .in("ticket_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: true });

    const waitingByTicket: Record<string, Array<{ started_at: string; ended_at?: string | null }>> = {};
    const openWait = new Map<string, string>();
    for (const audit of audits ?? []) {
      const beforeStatus = audit.before?.status;
      const afterStatus = audit.after?.status;
      if (afterStatus === "respondido" && beforeStatus !== "respondido") {
        openWait.set(audit.ticket_id, audit.created_at);
      }
      if (beforeStatus === "respondido" && afterStatus !== "respondido") {
        const started = openWait.get(audit.ticket_id);
        if (started) {
          waitingByTicket[audit.ticket_id] = [...(waitingByTicket[audit.ticket_id] ?? []), { started_at: started, ended_at: audit.created_at }];
          openWait.delete(audit.ticket_id);
        }
      }
    }
    for (const [ticketId, started] of openWait) {
      waitingByTicket[ticketId] = [...(waitingByTicket[ticketId] ?? []), { started_at: started, ended_at: null }];
    }

    const tickets = (rows ?? []).map((row: any) => ({
      id: row.id,
      ticket_number: row.ticket_number,
      restaurant_id: row.restaurant_id,
      restaurant_name: pickRestaurantName(row),
      subject: row.subject,
      category: row.category,
      priority: row.priority,
      status: row.status,
      assigned_to: row.assigned_to ?? null,
      assignee_label: row.assigned_to ? assigneeLabels.get(row.assigned_to) ?? null : null,
      created_at: row.created_at,
      first_response_at: row.first_response_at ?? null,
      resolved_at: row.resolved_at ?? null,
      closed_at: row.closed_at ?? null,
      reopened_count: row.reopened_count ?? 0,
    }));

    return {
      settings,
      ruleDescription:
        "Primeira resposta: created_at ate first_response_at. Resolucao: created_at ate resolved_at/closed_at. O status respondido pausa a resolucao quando ha auditoria de status; prioridade normal corresponde ao enum media.",
      report: buildSupportReports(tickets, settings, data, waitingByTicket),
    };
  });

export const getAdminSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ticketIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, role, allowedCategories } = await assertSupportRole(context.userId);

    const { data: ticket, error } = await (supabaseAdmin.from("support_tickets") as any)
      .select("*, restaurants(id, name, slug, whatsapp_phone)")
      .eq("id", data.ticketId)
      .single();
    if (error) throw new Error(error.message);
    assertCanAccessTicketCategory({ role, allowedCategories, category: ticket.category as SupportCategory });

    const { data: messages, error: messagesError } = await (supabaseAdmin.from("support_messages") as any)
      .select("*")
      .eq("ticket_id", data.ticketId)
      .order("created_at", { ascending: true });
    if (messagesError) throw new Error(messagesError.message);

    const assigneeLabels = await loadAssigneeLabels(supabaseAdmin, [ticket.assigned_to].filter(Boolean));
    return {
      ticket: normalizeTicket(
        ticket,
        (messages ?? []).filter((message: any) => !message.internal_note).at(-1)?.body ?? null,
        ticket.assigned_to ? assigneeLabels.get(ticket.assigned_to) ?? null : null,
      ),
      messages: (messages ?? []).map((message: any) => ({
        ...message,
        attachments: Array.isArray(message.attachments) ? message.attachments : [],
        internal_note: Boolean(message.internal_note),
      })),
    };
  });

export const listSupportTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, role, allowedCategories } = await assertSupportRole(context.userId);
    if (!canSupport(role, "manage_team") && role !== "support_manager") throw new Error("Forbidden");

    const { data, error } = await (supabaseAdmin.from("support_team_members") as any)
      .select("user_id, name, email, role, active, created_at")
      .eq("active", true)
      .in("role", managedSupportRoles);
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      user_id: row.user_id,
      role: String(row.role) as ManagedSupportRole,
      label: row.name || row.email || row.user_id,
      created_at: row.created_at,
    }));
  });

const assignSchema = ticketIdSchema.extend({ assigneeId: z.string().uuid().nullable() });

export const takeSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ticketIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, role, allowedCategories } = await assertSupportRole(context.userId);
    if (!canSupport(role, "take")) throw new Error("Forbidden");

    const { data: before, error: beforeError } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("id", data.ticketId)
      .single();
    if (beforeError) throw new Error(beforeError.message);
    assertCanAccessTicketCategory({ role, allowedCategories, category: before.category as SupportCategory });

    const { error } = await (supabaseAdmin as any).rpc("support_admin_take_ticket", {
      _actor_user_id: context.userId,
      _ticket_id: data.ticketId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assignSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, role, allowedCategories } = await assertSupportRole(context.userId);
    if (!canSupport(role, "assign")) throw new Error("Forbidden");

    const { data: before, error: beforeError } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("id", data.ticketId)
      .single();
    if (beforeError) throw new Error(beforeError.message);
    assertCanAccessTicketCategory({ role, allowedCategories, category: before.category as SupportCategory });
    if (data.assigneeId) {
      const { data: target, error: targetError } = await (supabaseAdmin.from("support_team_members") as any)
        .select("role, active, allowed_categories")
        .eq("user_id", data.assigneeId)
        .maybeSingle();
      if (targetError) throw new Error(targetError.message);
      if (!target?.active) throw new Error("Assignee is inactive");
      if (String(target.role) === "support_agent") {
        const targetAllowed = Array.isArray(target.allowed_categories) ? target.allowed_categories : [];
        if (!targetAllowed.includes(before.category)) throw new Error("Assignee cannot access ticket category");
      }
    }

    const { error } = await (supabaseAdmin as any).rpc("support_admin_assign_ticket", {
      _actor_user_id: context.userId,
      _ticket_id: data.ticketId,
      _assignee_id: data.assigneeId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const metaSchema = ticketIdSchema.extend({
  priority: prioritySchema.optional(),
  category: categorySchema.optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
});

export const updateSupportTicketMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => metaSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, role, allowedCategories } = await assertSupportRole(context.userId);
    if (data.priority && !canSupport(role, "change_priority")) throw new Error("Forbidden");
    if (data.category && !canSupport(role, "change_category")) throw new Error("Forbidden");

    const patch: Record<string, unknown> = {};
    if (data.priority) patch.priority = data.priority;
    if (data.category) patch.category = data.category;
    if (data.tags) patch.tags = data.tags;

    const { data: before, error: beforeError } = await supabaseAdmin.from("support_tickets").select("*").eq("id", data.ticketId).single();
    if (beforeError) throw new Error(beforeError.message);
    assertCanAccessTicketCategory({ role, allowedCategories, category: before.category as SupportCategory });
    const { error } = await (supabaseAdmin as any).rpc("support_admin_update_meta", {
      _actor_user_id: context.userId,
      _ticket_id: data.ticketId,
      _priority: (patch.priority as SupportPriority | undefined) ?? null,
      _category: (patch.category as SupportCategory | undefined) ?? null,
      _tags: (patch.tags as string[] | undefined) ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const statusUpdateSchema = ticketIdSchema.extend({ status: statusSchema });

export const updateSupportTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => statusUpdateSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, role, allowedCategories } = await assertSupportRole(context.userId);
    const action =
      data.status === "respondido"
        ? "waiting_customer"
        : data.status === "em_analise"
          ? "waiting_support"
          : data.status === "resolvido"
            ? "resolve"
            : data.status === "fechado"
              ? "close"
              : "reopen";

    if (!canSupport(role, action)) throw new Error("Forbidden");

    const { data: before, error: beforeError } = await supabaseAdmin.from("support_tickets").select("*").eq("id", data.ticketId).single();
    if (beforeError) throw new Error(beforeError.message);
    assertCanAccessTicketCategory({ role, allowedCategories, category: before.category as SupportCategory });
    if (data.status === "resolvido" && !canResolveTicket(role, before.assigned_to, context.userId)) throw new Error("Forbidden");

    const { error } = await (supabaseAdmin as any).rpc("support_admin_update_status", {
      _actor_user_id: context.userId,
      _ticket_id: data.ticketId,
      _status: data.status,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const messageSchema = ticketIdSchema.extend({
  body: z.string().trim().min(1).max(10_000),
  internalNote: z.boolean().optional(),
});

export const sendSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => messageSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, role, allowedCategories } = await assertSupportRole(context.userId);
    if (!canSupport(role, data.internalNote ? "internal_note" : "reply")) throw new Error("Forbidden");

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("support_tickets")
      .select("id, assigned_to, category")
      .eq("id", data.ticketId)
      .single();
    if (ticketError) throw new Error(ticketError.message);
    assertCanAccessTicketCategory({ role, allowedCategories, category: ticket.category as SupportCategory });

    const { error } = await (supabaseAdmin as any).rpc("support_admin_prepare_reply", {
      _actor_user_id: context.userId,
      _ticket_id: data.ticketId,
      _body: sanitizeSupportText(data.body),
      _internal_note: Boolean(data.internalNote),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSupportQuickReplies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await assertSupportRole(context.userId);
    const { data, error } = await (supabaseAdmin.from("support_quick_replies") as any)
      .select("id, code, title, body, category, position")
      .eq("active", true)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((reply: any) => ({
      ...reply,
      body: sanitizeSupportText(reply.body ?? ""),
    }));
  });

const articleSuggestionSchema = z.object({
  query: z.string().trim().max(500),
  limit: z.number().int().min(1).max(8).optional(),
});

export const suggestSupportArticles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => articleSuggestionSchema.parse(d ?? { query: "" }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin.from("support_articles") as any)
      .select("id, title, content, category, position, published, video_url")
      .eq("published", true)
      .eq("archived", false)
      .order("position", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    return suggestKnowledgeArticles(data.query, rows ?? [], data.limit ?? 4);
  });

const knowledgeArticleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(180),
  content: z.string().trim().min(3).max(20_000),
  category: z.string().trim().min(1).max(80),
  videoUrl: z.string().trim().url().max(500).nullable().optional(),
  position: z.number().int().min(0).max(10_000).optional(),
  published: z.boolean().optional(),
});

const articleIdSchema = z.object({ id: z.string().uuid() });
const articleSearchSchema = z.object({ search: z.string().trim().max(200).optional(), includeArchived: z.boolean().optional() });

export const listKnowledgeArticlesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => articleSearchSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, role } = await assertSupportRole(context.userId);
    if (role === "support_agent") throw new Error("Forbidden");

    let query = (supabaseAdmin.from("support_articles") as any)
      .select("*")
      .order("position", { ascending: true })
      .order("updated_at", { ascending: false });
    if (!data.includeArchived) query = query.eq("archived", false);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const term = data.search?.toLowerCase();
    return (rows ?? []).filter((article: any) => {
      if (!term) return true;
      return [article.title, article.content, article.category].join(" ").toLowerCase().includes(term);
    });
  });

export const saveKnowledgeArticleAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => knowledgeArticleSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, role } = await assertSupportRole(context.userId);
    if (role === "support_agent") throw new Error("Forbidden");
    const row = {
      title: sanitizeSupportText(data.title, 180),
      content: sanitizeSupportText(data.content, 20_000),
      category: sanitizeSupportText(data.category, 80),
      video_url: data.videoUrl ?? null,
      position: data.position ?? 0,
      published: data.published ?? false,
      archived: false,
    };
    const query = data.id
      ? (supabaseAdmin.from("support_articles") as any).update(row).eq("id", data.id)
      : (supabaseAdmin.from("support_articles") as any).insert(row);
    const { data: article, error } = await query.select("*").single();
    if (error) throw new Error(error.message);
    await auditSupportTeam({
      actorId: context.userId,
      action: data.id ? "support_knowledge.article_updated" : "support_knowledge.article_created",
      after: article,
    });
    return article;
  });

const articleStatusSchema = articleIdSchema.extend({ published: z.boolean().optional(), archived: z.boolean().optional() });

export const updateKnowledgeArticleStatusAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => articleStatusSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, role } = await assertSupportRole(context.userId);
    if (role === "support_agent") throw new Error("Forbidden");
    const patch: Record<string, unknown> = {};
    if (typeof data.published === "boolean") patch.published = data.published;
    if (typeof data.archived === "boolean") {
      patch.archived = data.archived;
      if (data.archived) patch.published = false;
    }
    const { data: before } = await (supabaseAdmin.from("support_articles") as any).select("*").eq("id", data.id).single();
    const { data: after, error } = await (supabaseAdmin.from("support_articles") as any)
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await auditSupportTeam({
      actorId: context.userId,
      action: data.archived ? "support_knowledge.article_archived" : "support_knowledge.article_status_changed",
      before,
      after,
    });
    return after;
  });

export const listInternalNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await assertSupportRole(context.userId);
    const { data, error } = await (supabaseAdmin.from("notifications") as any)
      .select("id, template_code, priority, payload_json, read_at, created_at")
      .eq("recipient_id", context.userId)
      .eq("recipient_type", "admin")
      .eq("origin", "support")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const notificationIdSchema = z.object({ id: z.string().uuid() });

export const markInternalNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => notificationIdSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await assertSupportRole(context.userId);
    const { error } = await (supabaseAdmin.from("notifications") as any)
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("recipient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const slaSettingsSchema = z.object({
  timezone: z.string().trim().min(1).max(80),
  pauseWhenWaitingCustomer: z.boolean(),
  nearDueThresholdMinutes: z.number().int().min(5).max(24 * 60),
  priorities: z.object({
    baixa: z.object({ firstResponseMinutes: z.number().int().min(5), resolutionMinutes: z.number().int().min(5) }),
    media: z.object({ firstResponseMinutes: z.number().int().min(5), resolutionMinutes: z.number().int().min(5) }),
    alta: z.object({ firstResponseMinutes: z.number().int().min(5), resolutionMinutes: z.number().int().min(5) }),
    urgente: z.object({ firstResponseMinutes: z.number().int().min(5), resolutionMinutes: z.number().int().min(5) }),
  }),
});

export const updateSupportSlaSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => slaSettingsSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await assertAdmin(context.userId);
    const serialized = serializeSupportSlaSettings(data);
    const { error } = await (supabaseAdmin.from("platform_settings") as any)
      .update({
        support_timezone: data.timezone,
        support_sla_settings: serialized,
        updated_by: context.userId,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    await auditSupportTeam({
      actorId: context.userId,
      action: "support.sla_settings_updated",
      after: serialized,
    });
    return { ok: true };
  });

const supportRoleSchema = z.enum(["support_manager", "support_agent"]);
const supportInviteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  role: supportRoleSchema,
  allowedCategories: z.array(categorySchema).max(12).optional(),
});

export const listSupportTeamManagement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await assertAdmin(context.userId);

    const { data: members, error } = await (supabaseAdmin.from("support_team_members") as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = (members ?? []).map((member: any) => member.user_id);
    const [ticketsQ, messagesQ, invitesQ] = await Promise.all([
      (supabaseAdmin.from("support_tickets") as any)
        .select("assigned_to, status, created_at, first_response_at, resolved_at, last_message_at")
        .in("assigned_to", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      (supabaseAdmin.from("support_messages") as any)
        .select("author_id, created_at")
        .eq("author_type", "suporte")
        .in("author_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"])
        .order("created_at", { ascending: false }),
      (supabaseAdmin.from("support_team_invites") as any)
        .select("id, name, email, role, allowed_categories, status, expires_at, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    const tickets = ticketsQ.data ?? [];
    const messages = messagesQ.data ?? [];
    const membersWithStats = (members ?? []).map((member: any) => {
      const assigned = tickets.filter((ticket: any) => ticket.assigned_to === member.user_id);
      const resolved = assigned.filter((ticket: any) => ticket.status === "resolvido");
      const firstResponseDurations = assigned
        .filter((ticket: any) => ticket.first_response_at)
        .map((ticket: any) => new Date(ticket.first_response_at).getTime() - new Date(ticket.created_at).getTime());
      const avgFirst =
        firstResponseDurations.length
          ? Math.round(firstResponseDurations.reduce((sum: number, value: number) => sum + value, 0) / firstResponseDurations.length / 60_000)
          : 0;
      const lastMessage = messages.find((message: any) => message.author_id === member.user_id)?.created_at ?? null;
      return {
        user_id: member.user_id,
        name: member.name,
        email: member.email,
        role: member.role,
        active: Boolean(member.active),
        allowed_categories: member.allowed_categories ?? [],
        invited_at: member.invited_at ?? null,
        accepted_at: member.accepted_at ?? null,
        last_activity_at: member.last_activity_at ?? lastMessage ?? assigned[0]?.last_message_at ?? null,
        active_tickets: assigned.filter((ticket: any) => !["resolvido", "fechado"].includes(ticket.status)).length,
        resolved_tickets: resolved.length,
        avg_first_response_minutes: avgFirst,
      };
    });

    return {
      members: membersWithStats,
      invites: (invitesQ.data ?? []).map((invite: any) => ({
        id: invite.id,
        name: invite.name,
        email: invite.email,
        role: invite.role,
        allowed_categories: invite.allowed_categories ?? [],
        status: invite.status,
        expires_at: invite.expires_at,
        created_at: invite.created_at,
      })),
    };
  });

export const inviteSupportTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => supportInviteSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await assertAdmin(context.userId);
    const email = data.email.toLowerCase();
    const { data: actorUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (actorUser.user?.email?.toLowerCase() === email) throw new Error("Forbidden");
    const token = randomBytes(32).toString("base64url");
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString();
    const allowed = data.allowedCategories ?? [];

    const { data: invite, error } = await (supabaseAdmin.from("support_team_invites") as any)
      .insert({
        name: data.name,
        email,
        role: data.role,
        allowed_categories: allowed,
        token_hash: tokenHash,
        invited_by: context.userId,
        expires_at: expiresAt,
      })
      .select("id, name, email, role, allowed_categories, status, expires_at, created_at")
      .single();
    if (error) throw new Error(error.message);

    const inviteUrl = `${appBaseUrl().replace(/\/$/, "")}/support-invite?token=${encodeURIComponent(token)}`;
    try {
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { name: data.name, support_invite_id: invite.id },
        redirectTo: inviteUrl,
      });
    } catch (error) {
      await auditSupportTeam({
        actorId: context.userId,
        action: "support_team.invite_email_failed",
        targetEmail: email,
        after: invite,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    await auditSupportTeam({
      actorId: context.userId,
      action: "support_team.invited",
      targetEmail: email,
      after: { ...invite, invite_url_created: true },
    });

    return { invite: { ...invite, allowed_categories: invite.allowed_categories ?? [] }, inviteUrl };
  });

const acceptInviteSchema = z.object({ token: z.string().min(20).max(200) });

export const acceptSupportInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => acceptInviteSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = sha256(data.token);
    const { data: invite, error } = await (supabaseAdmin.from("support_team_invites") as any)
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invite) throw new Error("Invite not found");

    try {
      assertSupportInviteNotExpired(invite);
    } catch (inviteError) {
      await (supabaseAdmin.from("support_team_invites") as any)
        .update({ status: "expired" })
        .eq("id", invite.id)
        .eq("status", "pending");
      throw inviteError;
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (userError) throw new Error(userError.message);
    const userEmail = userData.user?.email?.toLowerCase();
    if (!userEmail || userEmail !== String(invite.email).toLowerCase()) throw new Error("Invite belongs to another email");
    if (!isManagedSupportRole(invite.role)) throw new Error("Invalid invite role");

    const memberRow = {
      user_id: context.userId,
      name: invite.name,
      email: userEmail,
      role: invite.role,
      active: true,
      allowed_categories: invite.allowed_categories ?? [],
      invited_by: invite.invited_by,
      invited_at: invite.created_at,
      accepted_at: new Date().toISOString(),
    };

    const { error: memberError } = await (supabaseAdmin.from("support_team_members") as any)
      .upsert(memberRow, { onConflict: "user_id" });
    if (memberError) throw new Error(memberError.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", context.userId).in("role", managedSupportRoles as any);
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({
      user_id: context.userId,
      role: invite.role,
    } as any);
    if (roleError) throw new Error(roleError.message);

    const { error: inviteUpdateError } = await (supabaseAdmin.from("support_team_invites") as any)
      .update({ status: "accepted", accepted_by: context.userId, accepted_at: memberRow.accepted_at })
      .eq("id", invite.id);
    if (inviteUpdateError) throw new Error(inviteUpdateError.message);

    await auditSupportTeam({
      actorId: context.userId,
      action: "support_team.invite_accepted",
      targetUserId: context.userId,
      targetEmail: userEmail,
      after: memberRow,
    });

    return { ok: true };
  });

const updateMemberRoleSchema = z.object({
  userId: z.string().uuid(),
  role: supportRoleSchema,
  allowedCategories: z.array(categorySchema).max(12).optional(),
});

export const updateSupportTeamMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateMemberRoleSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, roles } = await assertAdmin(context.userId);
    if (!canChangeSupportMemberRole({ actorUserId: context.userId, targetUserId: data.userId, actorRoles: roles })) {
      throw new Error("Forbidden");
    }

    const { data: before, error: beforeError } = await (supabaseAdmin.from("support_team_members") as any)
      .select("*")
      .eq("user_id", data.userId)
      .single();
    if (beforeError) throw new Error(beforeError.message);

    const patch: Record<string, unknown> = { role: data.role };
    if (data.allowedCategories) patch.allowed_categories = data.allowedCategories;
    const { data: after, error } = await (supabaseAdmin.from("support_team_members") as any)
      .update(patch)
      .eq("user_id", data.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).in("role", managedSupportRoles as any);
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: data.role } as any);
    if (roleError) throw new Error(roleError.message);

    await auditSupportTeam({
      actorId: context.userId,
      action: "support_team.role_changed",
      targetUserId: data.userId,
      targetEmail: after.email,
      before,
      after,
    });
    return { ok: true };
  });

const activeMemberSchema = z.object({ userId: z.string().uuid(), active: z.boolean() });

export const setSupportTeamMemberActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => activeMemberSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, roles } = await assertAdmin(context.userId);
    if (!canSetSupportMemberActive({ actorUserId: context.userId, targetUserId: data.userId, actorRoles: roles })) {
      throw new Error("Forbidden");
    }

    const { data: before, error: beforeError } = await (supabaseAdmin.from("support_team_members") as any)
      .select("*")
      .eq("user_id", data.userId)
      .single();
    if (beforeError) throw new Error(beforeError.message);

    const { data: after, error } = await (supabaseAdmin.from("support_team_members") as any)
      .update({ active: data.active })
      .eq("user_id", data.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await auditSupportTeam({
      actorId: context.userId,
      action: data.active ? "support_team.activated" : "support_team.deactivated",
      targetUserId: data.userId,
      targetEmail: after.email,
      before,
      after,
    });
    return { ok: true };
  });

const removeAccessSchema = z.object({ userId: z.string().uuid() });

export const removeSupportTeamAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => removeAccessSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, roles } = await assertAdmin(context.userId);
    if (!canSetSupportMemberActive({ actorUserId: context.userId, targetUserId: data.userId, actorRoles: roles })) {
      throw new Error("Forbidden");
    }

    const { data: before, error: beforeError } = await (supabaseAdmin.from("support_team_members") as any)
      .select("*")
      .eq("user_id", data.userId)
      .single();
    if (beforeError) throw new Error(beforeError.message);

    const { data: after, error } = await (supabaseAdmin.from("support_team_members") as any)
      .update({ active: false })
      .eq("user_id", data.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).in("role", managedSupportRoles as any);
    await auditSupportTeam({
      actorId: context.userId,
      action: "support_team.access_removed",
      targetUserId: data.userId,
      targetEmail: after.email,
      before,
      after,
    });
    return { ok: true };
  });

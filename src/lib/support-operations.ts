import type { LegacySupportStatus, SupportCategory, SupportPriority } from "./support-admin";

export type SupportSlaPriorityRule = {
  firstResponseMinutes: number;
  resolutionMinutes: number;
};

export type SupportSlaSettings = {
  timezone: string;
  pauseWhenWaitingCustomer: boolean;
  nearDueThresholdMinutes: number;
  priorities: Record<SupportPriority, SupportSlaPriorityRule>;
};

export type SupportSlaTicketInput = {
  id?: string;
  priority: SupportPriority;
  status: LegacySupportStatus;
  created_at: string;
  first_response_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
};

export type SupportWaitingInterval = {
  started_at: string;
  ended_at?: string | null;
};

export type SupportSlaResult = {
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  pausedMinutes: number;
  firstResponseMinutes: number | null;
  resolutionMinutes: number | null;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
  firstResponseNearDue: boolean;
  resolutionNearDue: boolean;
  firstResponseMet: boolean | null;
  resolutionMet: boolean | null;
};

export type SupportQuickReplyContext = {
  restaurantName: string;
  ticketNumber: string | number;
  agentName: string;
};

export type SupportArticleSuggestion = {
  id: string;
  title: string;
  content: string;
  category: string;
  position?: number;
  published?: boolean;
  video_url?: string | null;
};

export type SupportReportTicket = SupportSlaTicketInput & {
  restaurant_id: string;
  restaurant_name: string;
  category: SupportCategory;
  assigned_to?: string | null;
  assignee_label?: string | null;
  ticket_number?: number | null;
  reopened_count?: number | null;
};

export type SupportReportFilters = {
  from?: string;
  to?: string;
  category?: SupportCategory;
  priority?: SupportPriority;
  restaurantId?: string;
  assignedTo?: string;
};

export const DEFAULT_SUPPORT_SLA_SETTINGS: SupportSlaSettings = {
  timezone: "America/Sao_Paulo",
  pauseWhenWaitingCustomer: true,
  nearDueThresholdMinutes: 60,
  priorities: {
    baixa: { firstResponseMinutes: 24 * 60, resolutionMinutes: 72 * 60 },
    media: { firstResponseMinutes: 12 * 60, resolutionMinutes: 24 * 60 },
    alta: { firstResponseMinutes: 4 * 60, resolutionMinutes: 8 * 60 },
    urgente: { firstResponseMinutes: 60, resolutionMinutes: 4 * 60 },
  },
};

export const SUPPORT_SLA_RULE_DESCRIPTION =
  "O SLA de primeira resposta conta de created_at ate first_response_at. O SLA de resolucao conta de created_at ate resolved_at/closed_at e pausa quando o chamado fica em respondido (aguardando cliente), usando o historico de auditoria de status quando disponivel. A prioridade normal usa o enum existente media.";

const TAG_RE = /<[^>]*>/g;

export function parseSupportSlaSettings(raw: unknown): SupportSlaSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SUPPORT_SLA_SETTINGS;
  const data = raw as Record<string, any>;
  const sourcePriorities = data.priorities ?? data;
  const priorities = { ...DEFAULT_SUPPORT_SLA_SETTINGS.priorities };

  for (const priority of Object.keys(priorities) as SupportPriority[]) {
    const entry = sourcePriorities?.[priority];
    if (!entry || typeof entry !== "object") continue;
    const first = Number(entry.firstResponseMinutes ?? entry.first_response_minutes);
    const resolution = Number(entry.resolutionMinutes ?? entry.resolution_minutes);
    priorities[priority] = {
      firstResponseMinutes: Number.isFinite(first) && first > 0 ? Math.round(first) : priorities[priority].firstResponseMinutes,
      resolutionMinutes: Number.isFinite(resolution) && resolution > 0 ? Math.round(resolution) : priorities[priority].resolutionMinutes,
    };
  }

  const near = Number(data.nearDueThresholdMinutes ?? data.near_due_threshold_minutes);
  return {
    timezone: typeof data.timezone === "string" && data.timezone.trim() ? data.timezone : DEFAULT_SUPPORT_SLA_SETTINGS.timezone,
    pauseWhenWaitingCustomer:
      typeof data.pauseWhenWaitingCustomer === "boolean"
        ? data.pauseWhenWaitingCustomer
        : typeof data.pause_when_waiting_customer === "boolean"
          ? data.pause_when_waiting_customer
          : DEFAULT_SUPPORT_SLA_SETTINGS.pauseWhenWaitingCustomer,
    nearDueThresholdMinutes: Number.isFinite(near) && near > 0 ? Math.round(near) : DEFAULT_SUPPORT_SLA_SETTINGS.nearDueThresholdMinutes,
    priorities,
  };
}

export function serializeSupportSlaSettings(settings: SupportSlaSettings) {
  return {
    timezone: settings.timezone,
    pause_when_waiting_customer: settings.pauseWhenWaitingCustomer,
    near_due_threshold_minutes: settings.nearDueThresholdMinutes,
    priorities: Object.fromEntries(
      (Object.keys(settings.priorities) as SupportPriority[]).map((priority) => [
        priority,
        {
          first_response_minutes: settings.priorities[priority].firstResponseMinutes,
          resolution_minutes: settings.priorities[priority].resolutionMinutes,
        },
      ]),
    ),
  };
}

export function sanitizeSupportText(value: string, maxLength = 10_000): string {
  return value
    .replace(TAG_RE, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, maxLength);
}

export function renderQuickReply(template: string, context: SupportQuickReplyContext): string {
  const variables: Record<string, string> = {
    restaurant_name: String(context.restaurantName),
    ticket_number: String(context.ticketNumber),
    agent_name: String(context.agentName),
  };
  const rendered = template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => variables[key.toLowerCase()] ?? "");
  return sanitizeSupportText(rendered);
}

export function calculatePausedMinutes(
  intervals: SupportWaitingInterval[],
  now = new Date(),
): number {
  return Math.round(
    intervals.reduce((sum, interval) => {
      const start = new Date(interval.started_at).getTime();
      const end = interval.ended_at ? new Date(interval.ended_at).getTime() : now.getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return sum;
      return sum + end - start;
    }, 0) / 60_000,
  );
}

export function calculateSupportSla(
  ticket: SupportSlaTicketInput,
  settings = DEFAULT_SUPPORT_SLA_SETTINGS,
  waitingIntervals: SupportWaitingInterval[] = [],
  now = new Date(),
): SupportSlaResult {
  const createdMs = new Date(ticket.created_at).getTime();
  const resolvedAt = ticket.resolved_at ?? ticket.closed_at ?? null;
  const pausedMinutes = settings.pauseWhenWaitingCustomer ? calculatePausedMinutes(waitingIntervals, now) : 0;
  const rule = settings.priorities[ticket.priority] ?? settings.priorities.media;

  const firstResponseDueMs = createdMs + rule.firstResponseMinutes * 60_000;
  const resolutionDueMs = createdMs + (rule.resolutionMinutes + pausedMinutes) * 60_000;
  const firstResponseMs = ticket.first_response_at ? new Date(ticket.first_response_at).getTime() : null;
  const resolutionMs = resolvedAt ? new Date(resolvedAt).getTime() : null;

  const firstOpen = !ticket.first_response_at && !["resolvido", "fechado"].includes(ticket.status);
  const resolutionOpen = !resolvedAt && !["fechado"].includes(ticket.status);
  const nearWindow = settings.nearDueThresholdMinutes * 60_000;

  return {
    firstResponseDueAt: ticket.first_response_at ? null : new Date(firstResponseDueMs).toISOString(),
    resolutionDueAt: resolvedAt ? null : new Date(resolutionDueMs).toISOString(),
    pausedMinutes,
    firstResponseMinutes: firstResponseMs ? Math.max(0, Math.round((firstResponseMs - createdMs) / 60_000)) : null,
    resolutionMinutes: resolutionMs ? Math.max(0, Math.round((resolutionMs - createdMs) / 60_000) - pausedMinutes) : null,
    firstResponseBreached: firstResponseMs ? firstResponseMs > firstResponseDueMs : firstOpen && now.getTime() > firstResponseDueMs,
    resolutionBreached: resolutionMs ? resolutionMs > resolutionDueMs : resolutionOpen && now.getTime() > resolutionDueMs,
    firstResponseNearDue: firstOpen && now.getTime() <= firstResponseDueMs && firstResponseDueMs - now.getTime() <= nearWindow,
    resolutionNearDue: resolutionOpen && now.getTime() <= resolutionDueMs && resolutionDueMs - now.getTime() <= nearWindow,
    firstResponseMet: firstResponseMs ? firstResponseMs <= firstResponseDueMs : null,
    resolutionMet: resolutionMs ? resolutionMs <= resolutionDueMs : null,
  };
}

function tokenize(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);
}

export function suggestKnowledgeArticles(
  query: string,
  articles: SupportArticleSuggestion[],
  limit = 4,
): SupportArticleSuggestion[] {
  const terms = Array.from(new Set(tokenize(query)));
  if (terms.length === 0) return [];
  return articles
    .filter((article) => article.published !== false)
    .map((article) => {
      const title = tokenize(article.title);
      const category = tokenize(article.category);
      const content = tokenize(article.content);
      const score = terms.reduce((sum, term) => {
        if (title.includes(term)) return sum + 6;
        if (category.includes(term)) return sum + 3;
        if (content.includes(term)) return sum + 1;
        return sum;
      }, 0);
      return { article, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (a.article.position ?? 0) - (b.article.position ?? 0))
    .slice(0, limit)
    .map((item) => item.article);
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function dateKey(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function increment(map: Record<string, number>, key: string, amount = 1) {
  map[key] = (map[key] ?? 0) + amount;
}

export function buildSupportReports(
  tickets: SupportReportTicket[],
  settings = DEFAULT_SUPPORT_SLA_SETTINGS,
  filters: SupportReportFilters = {},
  waitingByTicket: Record<string, SupportWaitingInterval[]> = {},
  now = new Date(),
) {
  const from = filters.from ? dateKey(`${filters.from}T00:00:00.000Z`, settings.timezone) : null;
  const to = filters.to ? dateKey(`${filters.to}T23:59:59.999Z`, settings.timezone) : null;
  const scoped = tickets.filter((ticket) => {
    const key = dateKey(ticket.created_at, settings.timezone);
    if (from && key < from) return false;
    if (to && key > to) return false;
    if (filters.category && ticket.category !== filters.category) return false;
    if (filters.priority && ticket.priority !== filters.priority) return false;
    if (filters.restaurantId && ticket.restaurant_id !== filters.restaurantId) return false;
    if (filters.assignedTo && ticket.assigned_to !== filters.assignedTo) return false;
    return true;
  });

  const byPeriod: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byRestaurant: Record<string, number> = {};
  const byAgent: Record<string, { assigned: number; resolved: number; avgFirstResponseMinutes: number; avgResolutionMinutes: number }> = {};
  const firstResponseDurations: number[] = [];
  const resolutionDurations: number[] = [];
  let slaMet = 0;
  let slaBreached = 0;
  let reopened = 0;

  for (const ticket of scoped) {
    increment(byPeriod, dateKey(ticket.created_at, settings.timezone));
    increment(byCategory, ticket.category);
    increment(byPriority, ticket.priority);
    increment(byRestaurant, ticket.restaurant_name || ticket.restaurant_id);
    reopened += ticket.reopened_count ?? 0;

    const sla = calculateSupportSla(ticket, settings, waitingByTicket[ticket.id ?? ""] ?? [], now);
    if (sla.firstResponseMinutes !== null) firstResponseDurations.push(sla.firstResponseMinutes);
    if (sla.resolutionMinutes !== null) resolutionDurations.push(sla.resolutionMinutes);
    if (sla.firstResponseMet === true) slaMet += 1;
    if (sla.resolutionMet === true) slaMet += 1;
    if (sla.firstResponseBreached || sla.resolutionBreached) slaBreached += 1;

    const agentKey = ticket.assignee_label || ticket.assigned_to || "Nao atribuido";
    const agent = byAgent[agentKey] ?? { assigned: 0, resolved: 0, avgFirstResponseMinutes: 0, avgResolutionMinutes: 0 };
    agent.assigned += ticket.assigned_to ? 1 : 0;
    agent.resolved += ticket.resolved_at ? 1 : 0;
    byAgent[agentKey] = agent;
  }

  for (const [agentName, agent] of Object.entries(byAgent)) {
    const assigned = scoped.filter((ticket) => (ticket.assignee_label || ticket.assigned_to || "Nao atribuido") === agentName);
    byAgent[agentName] = {
      ...agent,
      avgFirstResponseMinutes: average(
        assigned
          .filter((ticket) => ticket.first_response_at)
          .map((ticket) => Math.round((new Date(ticket.first_response_at!).getTime() - new Date(ticket.created_at).getTime()) / 60_000)),
      ),
      avgResolutionMinutes: average(
        assigned
          .filter((ticket) => ticket.resolved_at)
          .map((ticket) => Math.round((new Date(ticket.resolved_at!).getTime() - new Date(ticket.created_at).getTime()) / 60_000)),
      ),
    };
  }

  return {
    filters,
    timezone: settings.timezone,
    totalTickets: scoped.length,
    byPeriod,
    byCategory,
    byPriority,
    byRestaurant,
    byAgent,
    avgFirstResponseMinutes: average(firstResponseDurations),
    avgResolutionMinutes: average(resolutionDurations),
    slaMet,
    slaBreached,
    reopenRate: scoped.length ? Number(((reopened / scoped.length) * 100).toFixed(1)) : 0,
  };
}

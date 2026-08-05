export type SupportRole = "admin" | "support_manager" | "support_agent";
export type ManagedSupportRole = "support_manager" | "support_agent";

export type LegacySupportStatus =
  | "aberto"
  | "em_analise"
  | "respondido"
  | "resolvido"
  | "fechado";

export type CanonicalSupportStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_CUSTOMER"
  | "WAITING_SUPPORT"
  | "RESOLVED"
  | "CLOSED";

export type SupportPriority = "baixa" | "media" | "alta" | "urgente";

export type SupportCategory =
  | "problema_tecnico"
  | "pedido"
  | "pagamentos"
  | "cardapio"
  | "builder"
  | "impressao"
  | "financeiro"
  | "fidelidade"
  | "ia"
  | "sugestao"
  | "outro";

export type SupportTicketListItem = {
  id: string;
  ticket_number: number | null;
  restaurant_id: string;
  restaurant_name: string;
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: LegacySupportStatus;
  assigned_to: string | null;
  assignee_label: string | null;
  assigned_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  last_message_body: string | null;
  sla_due_at: string | null;
  tags: string[];
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  author_id: string;
  author_type: "cliente" | "suporte";
  body: string | null;
  attachments: unknown[];
  internal_note: boolean;
  created_at: string;
};

export type SupportTeamMember = {
  user_id: string;
  name: string;
  email: string;
  role: ManagedSupportRole;
  active: boolean;
  allowed_categories: SupportCategory[];
  invited_at: string | null;
  accepted_at: string | null;
  last_activity_at: string | null;
  active_tickets: number;
  resolved_tickets: number;
  avg_first_response_minutes: number;
};

export type SupportInvite = {
  id: string;
  name: string;
  email: string;
  role: ManagedSupportRole;
  allowed_categories: SupportCategory[];
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  created_at: string;
};

export type SupportAction =
  | "take"
  | "assign"
  | "transfer"
  | "change_priority"
  | "change_category"
  | "waiting_customer"
  | "waiting_support"
  | "resolve"
  | "reopen"
  | "close"
  | "reply"
  | "internal_note"
  | "manage_team"
  | "view_reports";

const ROLE_PERMISSIONS: Record<SupportRole, SupportAction[]> = {
  admin: [
    "take",
    "assign",
    "transfer",
    "change_priority",
    "change_category",
    "waiting_customer",
    "waiting_support",
    "resolve",
    "reopen",
    "close",
    "reply",
    "internal_note",
    "manage_team",
    "view_reports",
  ],
  support_manager: [
    "take",
    "assign",
    "transfer",
    "change_priority",
    "change_category",
    "waiting_customer",
    "waiting_support",
    "resolve",
    "reopen",
    "reply",
    "internal_note",
    "view_reports",
  ],
  support_agent: ["take", "waiting_customer", "resolve", "reply", "internal_note"],
};

export const STATUS_LABEL: Record<LegacySupportStatus, string> = {
  aberto: "Aberto",
  em_analise: "Aguardando suporte",
  respondido: "Aguardando cliente",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

export const PRIORITY_LABEL: Record<SupportPriority, string> = {
  baixa: "Baixa",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

export const CATEGORY_LABEL: Record<SupportCategory, string> = {
  problema_tecnico: "Problema tecnico",
  pedido: "Pedido",
  pagamentos: "Pagamentos",
  cardapio: "Cardapio",
  builder: "Monte do Seu Jeito",
  impressao: "Impressao",
  financeiro: "Financeiro",
  fidelidade: "Fidelidade",
  ia: "IA",
  sugestao: "Sugestao",
  outro: "Outro",
};

export const SUPPORT_STATUSES = Object.keys(STATUS_LABEL) as LegacySupportStatus[];
export const SUPPORT_PRIORITIES = Object.keys(PRIORITY_LABEL) as SupportPriority[];
export const SUPPORT_CATEGORIES = Object.keys(CATEGORY_LABEL) as SupportCategory[];
export const MANAGED_SUPPORT_ROLES: ManagedSupportRole[] = ["support_manager", "support_agent"];

export function isManagedSupportRole(role: string): role is ManagedSupportRole {
  return role === "support_manager" || role === "support_agent";
}

export function canManageSupportTeam(roles: string[]): boolean {
  return roles.includes("admin");
}

export function assertSupportInviteNotExpired(invite: { expires_at: string; status: string }, now = new Date()) {
  if (invite.status !== "pending") throw new Error("Invite is not pending");
  if (new Date(invite.expires_at).getTime() <= now.getTime()) throw new Error("Invite expired");
}

export function canChangeSupportMemberRole(input: { actorUserId: string; targetUserId: string; actorRoles: string[] }) {
  return input.actorRoles.includes("admin") && input.actorUserId !== input.targetUserId;
}

export function canSetSupportMemberActive(input: { actorUserId: string; targetUserId: string; actorRoles: string[] }) {
  return input.actorRoles.includes("admin") && input.actorUserId !== input.targetUserId;
}

export function supportMemberDisplayName(member: Pick<SupportTeamMember, "name" | "email"> | null | undefined, fallback: string) {
  return member?.name?.trim() || member?.email?.trim() || fallback;
}

export function toCanonicalStatus(status: LegacySupportStatus): CanonicalSupportStatus {
  const map: Record<LegacySupportStatus, CanonicalSupportStatus> = {
    aberto: "OPEN",
    em_analise: "WAITING_SUPPORT",
    respondido: "WAITING_CUSTOMER",
    resolvido: "RESOLVED",
    fechado: "CLOSED",
  };
  return map[status];
}

export function fromCanonicalStatus(status: CanonicalSupportStatus): LegacySupportStatus {
  const map: Record<CanonicalSupportStatus, LegacySupportStatus> = {
    OPEN: "aberto",
    IN_PROGRESS: "em_analise",
    WAITING_CUSTOMER: "respondido",
    WAITING_SUPPORT: "em_analise",
    RESOLVED: "resolvido",
    CLOSED: "fechado",
  };
  return map[status];
}

export function canSupport(role: SupportRole, action: SupportAction): boolean {
  return ROLE_PERMISSIONS[role].includes(action);
}

export function canAccessSupportCategory(role: SupportRole, allowedCategories: SupportCategory[], category: SupportCategory): boolean {
  if (role === "admin" || role === "support_manager") return true;
  return allowedCategories.includes(category);
}

export function canResolveTicket(role: SupportRole, assignedTo: string | null, actorId: string): boolean {
  if (role === "admin" || role === "support_manager") return true;
  return assignedTo === actorId;
}

export function canViewAdminSupport(roles: string[]): boolean {
  return roles.some((role) => role === "admin" || role === "support_manager" || role === "support_agent");
}

export function visibleMessagesForRestaurant(messages: SupportMessage[]): SupportMessage[] {
  return messages.filter((message) => !message.internal_note);
}

export function calculateSlaDueAt(ticket: {
  priority: SupportPriority;
  created_at: string;
  first_response_at?: string | null;
}): string | null {
  if (ticket.first_response_at) return null;
  const hoursByPriority: Record<SupportPriority, number> = {
    urgente: 1,
    alta: 4,
    media: 12,
    baixa: 24,
  };
  return new Date(new Date(ticket.created_at).getTime() + hoursByPriority[ticket.priority] * 3_600_000).toISOString();
}

export function isSlaBreached(ticket: { sla_due_at?: string | null }, now = new Date()): boolean {
  return Boolean(ticket.sla_due_at && new Date(ticket.sla_due_at).getTime() < now.getTime());
}

export function sortSupportTickets<T extends SupportTicketListItem>(tickets: T[], now = new Date()): T[] {
  const priorityWeight: Record<SupportPriority, number> = {
    urgente: 0,
    alta: 1,
    media: 2,
    baixa: 3,
  };

  return [...tickets].sort((a, b) => {
    const urgent = Number(a.priority !== "urgente") - Number(b.priority !== "urgente");
    if (urgent !== 0) return urgent;

    const sla = Number(!isSlaBreached(a, now)) - Number(!isSlaBreached(b, now));
    if (sla !== 0) return sla;

    const aNoFirst = !a.first_response_at && !["resolvido", "fechado"].includes(a.status);
    const bNoFirst = !b.first_response_at && !["resolvido", "fechado"].includes(b.status);
    if (aNoFirst !== bNoFirst) return aNoFirst ? -1 : 1;
    if (aNoFirst && bNoFirst) {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }

    const prio = priorityWeight[a.priority] - priorityWeight[b.priority];
    if (prio !== 0) return prio;

    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
  });
}

export function buildSupportMetrics(tickets: SupportTicketListItem[], now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const firstResponseDurations = tickets
    .filter((ticket) => ticket.first_response_at)
    .map((ticket) => new Date(ticket.first_response_at!).getTime() - new Date(ticket.created_at).getTime());
  const resolutionDurations = tickets
    .filter((ticket) => ticket.resolved_at)
    .map((ticket) => new Date(ticket.resolved_at!).getTime() - new Date(ticket.created_at).getTime());

  const average = (values: number[]) =>
    values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length / 60_000) : 0;

  return {
    totalOpen: tickets.filter((ticket) => ["aberto", "em_analise", "respondido"].includes(ticket.status)).length,
    urgent: tickets.filter((ticket) => ticket.priority === "urgente" && !["resolvido", "fechado"].includes(ticket.status)).length,
    inProgress: tickets.filter((ticket) => ticket.assigned_to && !["resolvido", "fechado"].includes(ticket.status)).length,
    waitingCustomer: tickets.filter((ticket) => ticket.status === "respondido").length,
    waitingSupport: tickets.filter((ticket) => ["aberto", "em_analise"].includes(ticket.status)).length,
    resolvedToday: tickets.filter((ticket) => ticket.resolved_at?.startsWith(today)).length,
    avgFirstResponseMinutes: average(firstResponseDurations),
    avgResolutionMinutes: average(resolutionDurations),
  };
}

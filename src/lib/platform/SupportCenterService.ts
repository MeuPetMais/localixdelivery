// Estruturas leves para Suporte / Moderação / Incidentes / Notificações globais.
// Aproveitam as tabelas existentes (support_tickets, support_messages, reviews)
// para consulta. Este módulo é apenas de projeção e validação — não abre
// conexão direta e não substitui os serviços de domínio existentes.

export type SupportPriority = "low" | "medium" | "high" | "urgent";
export type SupportStatus = "open" | "assigned" | "waiting" | "resolved" | "closed";

export interface SupportTicketProjection {
  id: string;
  ticket_number: number | null;
  subject: string;
  status: SupportStatus;
  priority: SupportPriority;
  assignee_id: string | null;
  restaurant_id: string;
  created_at: string;
  last_message_at: string | null;
}

export const SupportCenterService = {
  priorityWeight(p: SupportPriority): number {
    return { urgent: 4, high: 3, medium: 2, low: 1 }[p];
  },
  sort(tickets: SupportTicketProjection[]): SupportTicketProjection[] {
    return [...tickets].sort((a, b) => {
      const p = this.priorityWeight(b.priority) - this.priorityWeight(a.priority);
      if (p !== 0) return p;
      return (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at);
    });
  },
  slaBreached(ticket: SupportTicketProjection, now = new Date()): boolean {
    const slaHours = { urgent: 2, high: 8, medium: 24, low: 72 }[ticket.priority];
    const ref = new Date(ticket.last_message_at ?? ticket.created_at).getTime();
    return now.getTime() - ref > slaHours * 3_600_000;
  },
};

export type ModerationTargetType = "restaurant" | "review" | "menu_item" | "customer";
export type ModerationAction = "reviewed" | "hidden" | "restored" | "flagged" | "dismissed";

export interface ModerationEvent {
  id?: string;
  target_type: ModerationTargetType;
  target_id: string;
  action: ModerationAction;
  reason?: string;
  actor_id: string;
  created_at?: string;
}

export const ModerationCenterService = {
  validate(event: ModerationEvent): void {
    if (!event.target_id) throw new Error("target_id required");
    if (!event.actor_id) throw new Error("actor_id required");
  },
};

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "mitigated" | "resolved";

export interface Incident {
  id?: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affected_area: string;
  opened_at: string;
  resolved_at?: string | null;
}

export const IncidentCenterService = {
  isOpen(incident: Incident): boolean {
    return incident.status !== "resolved";
  },
  duration(incident: Incident, now = new Date()): number {
    const end = incident.resolved_at ? new Date(incident.resolved_at).getTime() : now.getTime();
    return end - new Date(incident.opened_at).getTime();
  },
};

export interface GlobalNotification {
  id?: string;
  audience: "all_tenants" | "admins" | "specific_tenants";
  target_ids?: string[];
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  created_at?: string;
}

export const GlobalNotificationCenterService = {
  validate(n: GlobalNotification): void {
    if (!n.title || !n.body) throw new Error("title and body required");
    if (n.audience === "specific_tenants" && !(n.target_ids?.length)) {
      throw new Error("target_ids required for specific_tenants");
    }
  },
};

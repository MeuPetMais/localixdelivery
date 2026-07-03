// Scheduler — utilitário puro para agendar envios futuros.
// A execução real (worker/cron) é responsabilidade de um próximo prompt.
import type { NotificationPriority, NotificationRequest } from "./types";

export interface ScheduledPlan {
  scheduled_at: string;
  priority: NotificationPriority;
}

export function scheduleAt(date: Date, priority: NotificationPriority = "NORMAL"): ScheduledPlan {
  return { scheduled_at: date.toISOString(), priority };
}

export function scheduleReminder(minutesAhead: number, priority: NotificationPriority = "NORMAL"): ScheduledPlan {
  return scheduleAt(new Date(Date.now() + minutesAhead * 60_000), priority);
}

export function scheduleAbandonedCart(): ScheduledPlan {
  // 30 minutos após o evento de carrinho abandonado.
  return scheduleReminder(30, "LOW");
}

export function scheduleMarketing(runAt: Date): ScheduledPlan {
  return scheduleAt(runAt, "LOW");
}

export function normalizeRequest(req: NotificationRequest): NotificationRequest {
  return {
    ...req,
    channel: req.channel ?? "IN_APP",
    priority: req.priority ?? "NORMAL",
    language: req.language ?? "pt-BR",
    payload: req.payload ?? {},
    scheduled_at: req.scheduled_at ?? new Date().toISOString(),
    recipient_type: req.recipient_type ?? "customer",
  };
}

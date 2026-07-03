// PreferenceService — valida se o canal/tipo/horário está permitido.
import type { NotificationChannel, NotificationPreferences } from "./types";

export interface PreferenceRepo {
  get(userId: string): Promise<NotificationPreferences | null>;
}

const CHANNEL_FIELD: Record<NotificationChannel, keyof NotificationPreferences | null> = {
  IN_APP: "in_app_enabled",
  PUSH: "push_enabled",
  EMAIL: "email_enabled",
  SMS: "sms_enabled",
  WHATSAPP: "whatsapp_enabled",
  WEBSOCKET: null, // sempre permitido (canal técnico)
};

export interface PreferenceDecision {
  allowed: boolean;
  reason?: string;
}

export class NotificationPreferenceService {
  constructor(private readonly repo: PreferenceRepo) {}

  async isAllowed(
    userId: string | null,
    channel: NotificationChannel,
    opts?: { marketing?: boolean; nowHour?: number },
  ): Promise<PreferenceDecision> {
    if (!userId) return { allowed: true }; // recipients anônimos (system)
    const prefs = await this.repo.get(userId);
    if (!prefs) return { allowed: true }; // defaults do banco

    const field = CHANNEL_FIELD[channel];
    if (field && prefs[field] === false) {
      return { allowed: false, reason: `channel_disabled:${channel}` };
    }
    if (opts?.marketing && !prefs.marketing_enabled) {
      return { allowed: false, reason: "marketing_disabled" };
    }
    const nowHour = opts?.nowHour ?? new Date().getHours();
    const qs = prefs.quiet_hours_start;
    const qe = prefs.quiet_hours_end;
    if (qs != null && qe != null && inQuietHours(nowHour, qs, qe)) {
      return { allowed: false, reason: "quiet_hours" };
    }
    return { allowed: true };
  }
}

export function inQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end; // faixa que cruza meia-noite
}

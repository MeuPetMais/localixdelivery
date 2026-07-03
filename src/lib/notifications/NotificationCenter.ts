// NotificationCenter — fachada única para criar/consultar notificações.
// Este prompt: recebe solicitações, consulta preferências, escolhe canal, coloca na fila.
// Não envia ainda (dispatch será acionado por worker em prompt futuro).
import type {
  NotificationChannel,
  NotificationRecord,
  NotificationRequest,
} from "./types";
import { NotificationPreferenceService } from "./NotificationPreferenceService";
import { normalizeRequest } from "./NotificationScheduler";

export interface NotificationRepo {
  enqueue(input: {
    recipient_id: string | null;
    recipient_type: NotificationRequest["recipient_type"];
    channel: NotificationChannel;
    template_code: string;
    priority: NotificationRequest["priority"];
    payload_json: Record<string, unknown>;
    scheduled_at: string;
    origin: string | null;
  }): Promise<NotificationRecord>;
  markStatus(id: string, patch: Partial<NotificationRecord>): Promise<void>;
  listPending(limit: number): Promise<NotificationRecord[]>;
  listForRecipient(recipientId: string, limit: number): Promise<NotificationRecord[]>;
}

export interface NotificationCenterDeps {
  repo: NotificationRepo;
  preferences: NotificationPreferenceService;
  audit?: {
    dropped: (req: NotificationRequest, reason: string) => Promise<void>;
  };
}

export interface NotifyResult {
  enqueued: boolean;
  reason?: string;
  notification?: NotificationRecord;
}

export class NotificationCenter {
  constructor(private readonly deps: NotificationCenterDeps) {}

  async notify(rawReq: NotificationRequest): Promise<NotifyResult> {
    const req = normalizeRequest(rawReq);
    const channel = req.channel ?? "IN_APP";

    const pref = await this.deps.preferences.isAllowed(req.recipient_id, channel);
    if (!pref.allowed) {
      await this.deps.audit?.dropped(req, pref.reason ?? "not_allowed");
      return { enqueued: false, reason: pref.reason };
    }

    const notification = await this.deps.repo.enqueue({
      recipient_id: req.recipient_id,
      recipient_type: req.recipient_type ?? "customer",
      channel,
      template_code: req.template_code,
      priority: req.priority ?? "NORMAL",
      payload_json: req.payload ?? {},
      scheduled_at: req.scheduled_at ?? new Date().toISOString(),
      origin: req.origin ?? null,
    });

    return { enqueued: true, notification };
  }

  async pending(limit = 50) {
    return this.deps.repo.listPending(limit);
  }

  async forRecipient(recipientId: string, limit = 50) {
    return this.deps.repo.listForRecipient(recipientId, limit);
  }
}

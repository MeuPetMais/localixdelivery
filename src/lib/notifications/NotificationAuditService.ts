// Auditoria — persiste 1 linha em notification_logs por envio.
import type { NotificationStatus } from "./types";

export interface AuditRepo {
  log(entry: {
    notification_id: string;
    provider: string;
    status: NotificationStatus;
    response?: Record<string, unknown> | null;
    error_message?: string | null;
    execution_time?: number | null;
  }): Promise<void>;
}

export class NotificationAuditService {
  constructor(private readonly repo: AuditRepo) {}
  async record(entry: Parameters<AuditRepo["log"]>[0]): Promise<void> {
    try {
      await this.repo.log(entry);
    } catch (err) {
      console.error("[NotificationAudit] falhou ao registrar log", err);
    }
  }
}

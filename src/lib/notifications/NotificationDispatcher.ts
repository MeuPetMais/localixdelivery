// Dispatcher — seleciona provider, renderiza template, envia e retorna resultado.
import type { NotificationRecord, ProviderSendResult } from "./types";
import { getProvider } from "./providers";
import { NotificationTemplateEngine } from "./NotificationTemplateEngine";
import { NotificationAuditService } from "./NotificationAuditService";
import { planRetry } from "./RetryEngine";

export interface DispatchOutcome {
  result: ProviderSendResult;
  next_status: NotificationRecord["status"];
  next_attempt_at?: string;
  attempts: number;
}

export class NotificationDispatcher {
  constructor(
    private readonly templates: NotificationTemplateEngine,
    private readonly audit: NotificationAuditService,
  ) {}

  async dispatch(record: NotificationRecord, language = "pt-BR"): Promise<DispatchOutcome> {
    const provider = getProvider(record.channel);
    const start = Date.now();
    let result: ProviderSendResult;
    try {
      const rendered = await this.templates.render(
        record.template_code,
        record.channel,
        language,
        record.payload_json ?? {},
      );
      const ok = await provider.validate(record);
      if (!ok) {
        result = { ok: false, status: "FAILED", error_message: "provider_validation_failed" };
      } else {
        result = await provider.send(record, rendered);
      }
    } catch (err) {
      result = {
        ok: false,
        status: "FAILED",
        error_message: err instanceof Error ? err.message : String(err),
      };
    }
    result.execution_time = result.execution_time ?? Date.now() - start;

    await this.audit.record({
      notification_id: record.id,
      provider: provider.name,
      status: result.status,
      response: result.response ?? null,
      error_message: result.error_message ?? null,
      execution_time: result.execution_time ?? null,
    });

    if (result.ok) {
      return { result, next_status: "SENT", attempts: record.attempts + 1 };
    }
    const retry = planRetry(record.attempts, record.max_attempts);
    return {
      result,
      next_status: retry.next_status,
      next_attempt_at: retry.next_attempt_at,
      attempts: retry.attempts,
    };
  }
}

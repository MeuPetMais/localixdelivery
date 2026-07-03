import type { NotificationProvider } from "./NotificationProvider";
import type { NotificationRecord, NotificationRenderResult, ProviderSendResult } from "../types";

// InAppProvider — único provider implementado neste prompt.
// Grava a notificação como "SENT" para leitura no bell do app.
// A persistência real (customer_notifications) é feita pelo NotificationCenter
// para reaproveitar o repo autenticado; aqui apenas marcamos sucesso.
export class InAppProvider implements NotificationProvider {
  readonly channel = "IN_APP" as const;
  readonly name = "in-app";

  async send(_r: NotificationRecord, rendered: NotificationRenderResult): Promise<ProviderSendResult> {
    const start = Date.now();
    return {
      ok: true,
      status: "SENT",
      response: { title: rendered.title, body: rendered.body },
      execution_time: Date.now() - start,
    };
  }
  async validate(record: NotificationRecord): Promise<boolean> {
    return !!record.template_code;
  }
  async health(): Promise<boolean> {
    return true;
  }
}

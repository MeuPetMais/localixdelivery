import type { NotificationChannel, NotificationRecord, NotificationRenderResult, ProviderSendResult } from "../types";

export interface NotificationProvider {
  readonly channel: NotificationChannel;
  readonly name: string;
  send(record: NotificationRecord, rendered: NotificationRenderResult): Promise<ProviderSendResult>;
  validate(record: NotificationRecord): Promise<boolean>;
  health(): Promise<boolean>;
}

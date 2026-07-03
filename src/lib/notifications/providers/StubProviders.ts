// Providers preparados mas não implementados neste prompt.
// send() retorna PENDING para que o dispatcher marque como noop e agende retry/manual.
import type { NotificationProvider } from "./NotificationProvider";
import type { NotificationChannel, NotificationRecord, ProviderSendResult } from "../types";

class NotImplementedProvider implements NotificationProvider {
  constructor(public readonly channel: NotificationChannel, public readonly name: string) {}
  async send(_r: NotificationRecord): Promise<ProviderSendResult> {
    return { ok: false, status: "PENDING", error_message: `${this.name}_not_implemented` };
  }
  async validate(): Promise<boolean> {
    return false;
  }
  async health(): Promise<boolean> {
    return false;
  }
}

export const PushProvider = new NotImplementedProvider("PUSH", "push");
export const EmailProvider = new NotImplementedProvider("EMAIL", "email");
export const SMSProvider = new NotImplementedProvider("SMS", "sms");
export const WhatsAppProvider = new NotImplementedProvider("WHATSAPP", "whatsapp");
export const WebSocketProvider = new NotImplementedProvider("WEBSOCKET", "websocket");

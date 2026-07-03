import { InAppProvider } from "./InAppProvider";
import { PushProvider, EmailProvider, SMSProvider, WhatsAppProvider, WebSocketProvider } from "./StubProviders";
import type { NotificationChannel } from "../types";
import type { NotificationProvider } from "./NotificationProvider";

const REGISTRY: Record<NotificationChannel, NotificationProvider> = {
  IN_APP: new InAppProvider(),
  PUSH: PushProvider,
  EMAIL: EmailProvider,
  SMS: SMSProvider,
  WHATSAPP: WhatsAppProvider,
  WEBSOCKET: WebSocketProvider,
};

export function getProvider(channel: NotificationChannel): NotificationProvider {
  return REGISTRY[channel];
}

export type { NotificationProvider } from "./NotificationProvider";

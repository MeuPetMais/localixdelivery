import { supabase } from "@/integrations/supabase/client";
import { CommunicationEventBus } from "./CommunicationEventBus";
import type { CommunicationChannel, CommunicationPreferences } from "./types";

const T = () => (supabase as any).from("customer_communication_preferences");

const DEFAULTS = (customerId: string): CommunicationPreferences => ({
  customer_id: customerId,
  email_enabled: true,
  push_enabled: true,
  sms_enabled: false,
  whatsapp_enabled: true,
  in_app_enabled: true,
  marketing_enabled: false,
});

const CHANNEL_FIELD: Record<CommunicationChannel, keyof CommunicationPreferences> = {
  EMAIL: "email_enabled",
  PUSH: "push_enabled",
  SMS: "sms_enabled",
  WHATSAPP: "whatsapp_enabled",
  IN_APP: "in_app_enabled",
};

export const CommunicationPreferenceService = {
  defaults: DEFAULTS,
  channelField: (c: CommunicationChannel) => CHANNEL_FIELD[c],

  async get(customerId: string): Promise<CommunicationPreferences> {
    const { data, error } = await T().select("*").eq("customer_id", customerId).maybeSingle();
    if (error) throw error;
    return (data ?? DEFAULTS(customerId)) as CommunicationPreferences;
  },

  async upsert(customerId: string, patch: Partial<CommunicationPreferences>): Promise<CommunicationPreferences> {
    const current = await CommunicationPreferenceService.get(customerId);
    const next = { ...current, ...patch, customer_id: customerId };
    const { data, error } = await T().upsert(next, { onConflict: "customer_id" }).select().maybeSingle();
    if (error) throw error;
    await CommunicationEventBus.publish({
      type: "CommunicationPreferenceChanged",
      customerId, changes: patch, at: new Date().toISOString(),
    });
    return (data ?? next) as CommunicationPreferences;
  },

  async setChannel(customerId: string, channel: CommunicationChannel, enabled: boolean) {
    const field = CHANNEL_FIELD[channel];
    const result = await CommunicationPreferenceService.upsert(customerId, { [field]: enabled } as Partial<CommunicationPreferences>);
    await CommunicationEventBus.publish({
      type: enabled ? "CustomerOptedIn" : "CustomerOptedOut",
      customerId, channel, at: new Date().toISOString(),
    });
    return result;
  },

  isAllowed(prefs: CommunicationPreferences, channel: CommunicationChannel, opts?: { marketing?: boolean }) {
    if (opts?.marketing && !prefs.marketing_enabled) return false;
    return Boolean(prefs[CHANNEL_FIELD[channel]]);
  },
} as const;

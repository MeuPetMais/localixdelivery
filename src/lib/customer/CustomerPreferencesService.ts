import { supabase } from "@/integrations/supabase/client";
import { CustomerEventBus } from "./CustomerEventBus";
import { CustomerValidator } from "./CustomerValidator";
import type { CustomerPreferences } from "./types";

const T = () => (supabase as any).from("customer_preferences");

const DEFAULTS = (customerId: string): CustomerPreferences => ({
  customer_id: customerId,
  preferred_payment_method: null,
  preferred_channel: null,
  preferred_category: null,
  dietary_restrictions: [],
  language: "pt-BR",
  marketing_opt_in: false,
  push_opt_in: true,
  email_opt_in: true,
  whatsapp_opt_in: true,
});

export const CustomerPreferencesService = {
  async get(customerId: string): Promise<CustomerPreferences> {
    const { data, error } = await T().select("*").eq("customer_id", customerId).maybeSingle();
    if (error) throw error;
    return (data ?? DEFAULTS(customerId)) as CustomerPreferences;
  },

  async upsert(customerId: string, patch: Partial<CustomerPreferences>): Promise<CustomerPreferences> {
    const validation = CustomerValidator.validatePreferences(patch);
    if (!validation.ok) throw new Error(validation.issues.map((i) => i.message).join("; "));
    const current = await CustomerPreferencesService.get(customerId);
    const next = { ...current, ...patch, customer_id: customerId };
    const { data, error } = await T().upsert(next, { onConflict: "customer_id" }).select().maybeSingle();
    if (error) throw error;
    await CustomerEventBus.publish({
      type: "PreferenceChanged",
      customerId,
      changes: patch as Record<string, unknown>,
      at: new Date().toISOString(),
    });
    return data as CustomerPreferences;
  },
} as const;

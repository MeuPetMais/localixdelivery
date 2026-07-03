import { supabase } from "@/integrations/supabase/client";
import { CustomerAudit } from "./CustomerAudit";
import { CustomerEventBus } from "./CustomerEventBus";
import { CustomerValidator } from "./CustomerValidator";
import { CustomerTimeline } from "./CustomerTimeline";
import { CustomerAddressService } from "./CustomerAddressService";
import { CustomerPreferencesService } from "./CustomerPreferencesService";
import { CustomerFavoritesService } from "./CustomerFavoritesService";
import type { CustomerConsent, CustomerConsentType, CustomerProfile } from "./types";

const P = () => (supabase as any).from("customer_profiles");
const C = () => (supabase as any).from("customer_consents");

/**
 * CustomerService — public facade of the Customer CRM Domain.
 * Reuses existing customer_profiles, customer_addresses, customer_favorites tables and
 * extends with preferences, timeline and LGPD consents.
 */
export const CustomerService = {
  // --- Profile
  async getProfile(customerId: string): Promise<CustomerProfile | null> {
    const { data, error } = await P().select("*").eq("id", customerId).maybeSingle();
    if (error) throw error;
    return (data ?? null) as CustomerProfile | null;
  },

  async updateProfile(customerId: string, patch: Partial<CustomerProfile>): Promise<CustomerProfile> {
    const v = CustomerValidator.validateProfile(patch);
    if (!v.ok) throw new Error(v.issues.map((i) => i.message).join("; "));
    const { data, error } = await P().update(patch).eq("id", customerId).select().maybeSingle();
    if (error) throw error;
    CustomerAudit.record({ customerId, action: "profile.updated", data: patch });
    await CustomerEventBus.publish({
      type: "CustomerUpdated", customerId, changes: patch as Record<string, unknown>,
      at: new Date().toISOString(),
    });
    return data as CustomerProfile;
  },

  // --- Consents (LGPD)
  async recordConsent(input: {
    customerId: string; consentType: CustomerConsentType; granted: boolean;
    source?: string; ip_address?: string; user_agent?: string;
  }): Promise<CustomerConsent> {
    const { data, error } = await C().insert({
      customer_id: input.customerId,
      consent_type: input.consentType,
      granted: input.granted,
      source: input.source ?? null,
      ip_address: input.ip_address ?? null,
      user_agent: input.user_agent ?? null,
    }).select().maybeSingle();
    if (error) throw error;
    CustomerAudit.record({
      customerId: input.customerId,
      action: "consent.recorded",
      data: { consent_type: input.consentType, granted: input.granted, source: input.source },
    });
    await CustomerEventBus.publish({
      type: "ConsentUpdated",
      customerId: input.customerId,
      consentType: input.consentType,
      granted: input.granted,
      at: new Date().toISOString(),
    });
    await CustomerTimeline.record({
      customer_id: input.customerId,
      event_type: "CONSENT_UPDATED",
      description: `Consent ${input.consentType} = ${input.granted}`,
      metadata: { consent_type: input.consentType, granted: input.granted },
    }).catch(() => null);
    return data as CustomerConsent;
  },

  async listConsents(customerId: string): Promise<CustomerConsent[]> {
    const { data, error } = await C()
      .select("*").eq("customer_id", customerId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as CustomerConsent[];
  },

  // --- History (Order domain integration, read-only)
  async listOrders(customerId: string, limit = 20): Promise<Array<{ id: string; total: number; status: string; created_at: string }>> {
    const { data, error } = await (supabase as any)
      .from("orders").select("id,total,status,created_at")
      .eq("customer_id", customerId).order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  // --- Sub-services (reuse)
  addresses: CustomerAddressService,
  preferences: CustomerPreferencesService,
  favorites: CustomerFavoritesService,
  timeline: CustomerTimeline,
} as const;

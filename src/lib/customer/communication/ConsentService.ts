import { CustomerService } from "../CustomerService";
import { CommunicationEventBus } from "./CommunicationEventBus";
import type { CustomerConsentType } from "../types";

/**
 * ConsentService — thin wrapper over CustomerService.recordConsent that also
 * emits CommunicationEventBus events for opt-in/out. Never sends messages.
 */
export const ConsentService = {
  async record(input: {
    customerId: string;
    consentType: CustomerConsentType;
    granted: boolean;
    source?: string;
    ip_address?: string;
    user_agent?: string;
  }) {
    const consent = await CustomerService.recordConsent(input);
    if (input.consentType === "marketing" || input.consentType === "notifications" || input.consentType === "promotions") {
      await CommunicationEventBus.publish({
        type: input.granted ? "CustomerOptedIn" : "CustomerOptedOut",
        customerId: input.customerId,
        channel: "IN_APP",
        at: new Date().toISOString(),
      });
    }
    return consent;
  },

  list: (customerId: string) => CustomerService.listConsents(customerId),

  async isGranted(customerId: string, type: CustomerConsentType): Promise<boolean> {
    const rows = await CustomerService.listConsents(customerId);
    const latest = rows.find((r) => r.consent_type === type);
    return Boolean(latest?.granted);
  },
} as const;

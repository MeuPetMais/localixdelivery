import { CommunicationPreferenceService } from "./CommunicationPreferenceService";
import { CommunicationHistoryService } from "./CommunicationHistoryService";
import { ConsentService } from "./ConsentService";
import { CampaignAudienceService, CampaignPreview } from "./CampaignAudienceService";
import type { CommunicationChannel } from "./types";

/**
 * CustomerCommunicationService — public facade of the Communication Center.
 * Reuses NotificationCenter for actual delivery; this module only handles
 * preferences, consents, history and campaign audience building.
 */
export const CustomerCommunicationService = {
  preferences: CommunicationPreferenceService,
  history: CommunicationHistoryService,
  consent: ConsentService,
  audience: CampaignAudienceService,
  preview: CampaignPreview,

  async optIn(customerId: string, channel: CommunicationChannel) {
    return CommunicationPreferenceService.setChannel(customerId, channel, true);
  },
  async optOut(customerId: string, channel: CommunicationChannel) {
    return CommunicationPreferenceService.setChannel(customerId, channel, false);
  },

  async canReach(customerId: string, channel: CommunicationChannel, opts?: { marketing?: boolean }) {
    const prefs = await CommunicationPreferenceService.get(customerId);
    return CommunicationPreferenceService.isAllowed(prefs, channel, opts);
  },
} as const;

import { CampaignService } from "./CampaignService";
import { AudienceBuilder } from "./AudienceBuilder";
import { AutomationEngine } from "./AutomationEngine";
import { CampaignSchedulerService } from "./CampaignSchedulerService";
import { CampaignTemplateService } from "./CampaignTemplateService";
import { CampaignAnalyticsService } from "./CampaignAnalyticsService";
import { JourneyBuilder } from "./JourneyBuilder";
import { ABTestingEngine } from "./ABTestingEngine";
import { MarketingAudit } from "./MarketingAudit";
import { MarketingEventBus } from "./MarketingEventBus";

/**
 * MarketingAutomationPlatform — pure facade. Never queries the DB directly and
 * never duplicates segmentation, notification or analytics logic. Consumers
 * bring candidates from CustomerIntelligence and metrics from AnalyticsPlatform.
 */
export const MarketingAutomationPlatform = {
  campaigns: CampaignService,
  audience: AudienceBuilder,
  automations: AutomationEngine,
  scheduler: CampaignSchedulerService,
  templates: CampaignTemplateService,
  analytics: CampaignAnalyticsService,
  journeys: JourneyBuilder,
  abTesting: ABTestingEngine,
  audit: MarketingAudit,
  events: MarketingEventBus,
} as const;

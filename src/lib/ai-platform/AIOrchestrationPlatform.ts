import { AIOrchestrator } from "./AIOrchestrator";
import { AIProviderRegistry } from "./AIProviderRegistry";
import { AISkillRegistry } from "./AISkillRegistry";
import { PromptManager } from "./PromptManager";
import { ContextBuilder } from "./ContextBuilder";
import { AISettingsService } from "./AISettingsService";
import { AISafetyLayer } from "./AISafetyLayer";
import { AIUsageService } from "./AIUsageService";
import { AIAuditService } from "./AIAuditService";
import { AIEventBus } from "./AIEventBus";
import { AIForecastService } from "./AIForecastService";
import { AIRecommendationsService } from "./AIRecommendationsService";

export const AIOrchestrationPlatform = {
  orchestrator: AIOrchestrator,
  providers: AIProviderRegistry,
  skills: AISkillRegistry,
  prompts: PromptManager,
  context: ContextBuilder,
  settings: AISettingsService,
  safety: AISafetyLayer,
  usage: AIUsageService,
  audit: AIAuditService,
  events: AIEventBus,
  forecast: AIForecastService,
  recommendations: AIRecommendationsService,
} as const;

import type {
  ChefContext,
  ChefRankingProfile,
  ChefRecommendationIntent,
  ChefRecommendationResult,
} from "../types";
import type { ChefCatalogService } from "../catalog/catalog-service";
import { recommendMenuItems } from "../tools/recommend-menu-items";

export type ChefIntentParseResult = {
  intent: ChefRecommendationIntent;
  rankingProfile?: ChefRankingProfile;
  needsClarification?: boolean;
  clarificationQuestion?: string | null;
};

export interface ChefIntentParser {
  parse(input: {
    message: string;
    locale?: string;
  }): Promise<ChefIntentParseResult>;
}

export interface ChefResponsePresenter {
  present(input: {
    message: string;
    intent: ChefRecommendationIntent;
    recommendation: ChefRecommendationResult;
    locale?: string;
  }): Promise<string>;
}

export type ChefOrchestratorInput = {
  message: string;
  limit?: number;
  now?: Date;
};

export type ChefOrchestratorResult =
  | {
      type: "clarification";
      text: string;
      intent: ChefRecommendationIntent;
    }
  | {
      type: "recommendation";
      text: string;
      intent: ChefRecommendationIntent;
      recommendation: ChefRecommendationResult;
    };

export async function orchestrateChefMessage(
  context: ChefContext,
  input: ChefOrchestratorInput,
  dependencies: {
    intentParser: ChefIntentParser;
    presenter: ChefResponsePresenter;
    catalogService: ChefCatalogService;
  },
): Promise<ChefOrchestratorResult> {
  const message = input.message.trim();
  if (!message) throw new Error("CHEF_EMPTY_MESSAGE");
  if (!context.restaurantId) throw new Error("CHEF_MISSING_RESTAURANT_CONTEXT");

  const parsed = await dependencies.intentParser.parse({
    message,
    locale: context.locale,
  });

  if (parsed.needsClarification && parsed.clarificationQuestion?.trim()) {
    return {
      type: "clarification",
      text: parsed.clarificationQuestion.trim(),
      intent: parsed.intent,
    };
  }

  const recommendation = await recommendMenuItems(
    { restaurantId: context.restaurantId },
    {
      intent: parsed.intent,
      rankingProfile: parsed.rankingProfile,
      limit: input.limit ?? 3,
      now: input.now,
    },
    dependencies.catalogService,
  );

  const text = await dependencies.presenter.present({
    message,
    intent: parsed.intent,
    recommendation,
    locale: context.locale,
  });

  return {
    type: "recommendation",
    text,
    intent: parsed.intent,
    recommendation,
  };
}

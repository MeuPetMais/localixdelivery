import { recommendProducts } from "../recommendation/recommend-products";
import type {
  ChefContext,
  ChefRankingProfile,
  ChefRecommendationIntent,
  ChefRecommendationResult,
} from "../types";
import type { ChefCatalogService } from "../catalog/catalog-service";

export type RecommendMenuItemsInput = {
  intent: ChefRecommendationIntent;
  rankingProfile?: ChefRankingProfile;
  limit?: number;
  now?: Date;
};

export async function recommendMenuItems(
  context: Pick<ChefContext, "restaurantId">,
  input: RecommendMenuItemsInput,
  catalogService: ChefCatalogService,
): Promise<ChefRecommendationResult> {
  const candidates = await catalogService.listRecommendationCandidates({
    restaurantId: context.restaurantId,
    now: input.now,
  });

  return recommendProducts(
    {
      restaurantId: context.restaurantId,
      intent: input.intent,
      rankingProfile: input.rankingProfile,
      limit: input.limit,
    },
    candidates,
  );
}

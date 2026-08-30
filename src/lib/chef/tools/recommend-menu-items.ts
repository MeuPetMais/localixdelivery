import { recommendProducts } from "../recommendation/recommend-products";
import type {
  ChefRankingProfile,
  ChefRecommendationIntent,
  ChefRecommendationResult,
} from "../types";
import type { ChefCatalogService } from "../catalog/catalog-service";

export type RecommendMenuItemsInput = {
  restaurantId: string;
  intent: ChefRecommendationIntent;
  rankingProfile?: ChefRankingProfile;
  limit?: number;
  now?: Date;
};

export async function recommendMenuItems(
  input: RecommendMenuItemsInput,
  catalogService: ChefCatalogService,
): Promise<ChefRecommendationResult> {
  const candidates = await catalogService.listRecommendationCandidates({
    restaurantId: input.restaurantId,
    now: input.now,
  });

  return recommendProducts(
    {
      restaurantId: input.restaurantId,
      intent: input.intent,
      rankingProfile: input.rankingProfile,
      limit: input.limit,
    },
    candidates,
  );
}

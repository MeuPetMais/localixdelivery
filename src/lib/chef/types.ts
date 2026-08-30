export type ChefRankingProfile =
  | "DEFAULT"
  | "BUDGET"
  | "PROMOTION"
  | "CATEGORY_SPECIFIC"
  | "MATCH_PREFERENCES";

export type ChefRecommendationConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ChefContext {
  restaurantId: string;
  slug?: string;
  journeyId?: string;
  sessionId?: string;
  customerId?: string | null;
  anonymousId?: string | null;
  channel: "text";
  locale?: string;
}

export type ChefRecommendationReasonCode =
  | "CATEGORY_MATCH"
  | "NAME_MATCH"
  | "DESCRIPTION_MATCH"
  | "OPTION_MATCH"
  | "WITHIN_BUDGET"
  | "LOW_PRICE"
  | "PROMOTION_ACTIVE"
  | "PROMOTION_REQUEST_MATCH"
  | "BESTSELLER"
  | "FEATURED_BY_RESTAURANT"
  | "WEEKLY_FAVORITE";

export type ChefRecommendationFallbackReason =
  | "NO_MATCH"
  | "NO_RESULT_WITHIN_BUDGET"
  | "DESIRED_TERM_NOT_FOUND"
  | "CATEGORY_NOT_AVAILABLE";

export interface ChefRecommendationIntent {
  category?: string | null;
  budgetMax?: number | null;
  desiredTerms?: string[];
  excludedTerms?: string[];
  promotionPreferred?: boolean;
  peopleCount?: number | null;
}

export interface ChefRecommendationRequest {
  restaurantId: string;
  intent: ChefRecommendationIntent;
  rankingProfile?: ChefRankingProfile;
  limit?: number;
}

export interface ChefRecommendationCandidate {
  productId: string;
  restaurantId: string;
  name: string;
  description?: string | null;
  category?: string | null;
  regularPrice: number;
  effectivePrice: number;
  promotionActive: boolean;
  isActive: boolean;
  isAvailable: boolean;
  isPaused: boolean;
  isBestseller?: boolean;
  isFeatured?: boolean;
  isWeeklyFavorite?: boolean;
  optionTerms?: string[];
}

export interface ChefRecommendationItem {
  productId: string;
  rank: number;
  score: number;
  regularPrice: number;
  effectivePrice: number;
  promotionActive: boolean;
  reasonCodes: ChefRecommendationReasonCode[];
  matchedTerms: string[];
}

export interface ChefRecommendationResult {
  recommendations: ChefRecommendationItem[];
  confidence: ChefRecommendationConfidence;
  fallbackReason?: ChefRecommendationFallbackReason;
  diagnostics: {
    candidateCount: number;
    eligibleCount: number;
    rankingProfile: ChefRankingProfile;
  };
}

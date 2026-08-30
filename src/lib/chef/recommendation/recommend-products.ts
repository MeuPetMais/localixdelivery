import type {
  ChefRankingProfile,
  ChefRecommendationCandidate,
  ChefRecommendationFallbackReason,
  ChefRecommendationItem,
  ChefRecommendationReasonCode,
  ChefRecommendationRequest,
  ChefRecommendationResult,
} from "../types";

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function includesTerm(value: string | null | undefined, term: string): boolean {
  return normalize(value ?? "").includes(normalize(term));
}

function hasExcludedTerm(candidate: ChefRecommendationCandidate, terms: string[]): boolean {
  return terms.some((term) =>
    [candidate.name, candidate.description ?? "", ...(candidate.optionTerms ?? [])].some((value) =>
      includesTerm(value, term),
    ),
  );
}

function matchesCategory(candidate: ChefRecommendationCandidate, category: string): boolean {
  return includesTerm(candidate.category, category) || includesTerm(candidate.name, category);
}

function profileFor(request: ChefRecommendationRequest): ChefRankingProfile {
  if (request.rankingProfile) return request.rankingProfile;
  if (request.intent.promotionPreferred) return "PROMOTION";
  if ((request.intent.desiredTerms?.length ?? 0) > 0) return "MATCH_PREFERENCES";
  if (request.intent.category) return "CATEGORY_SPECIFIC";
  return "DEFAULT";
}

function pushReason(
  reasons: ChefRecommendationReasonCode[],
  reason: ChefRecommendationReasonCode,
): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function scoreCandidate(
  candidate: ChefRecommendationCandidate,
  request: ChefRecommendationRequest,
  profile: ChefRankingProfile,
): Omit<ChefRecommendationItem, "rank"> {
  const reasons: ChefRecommendationReasonCode[] = [];
  const matchedTerms: string[] = [];
  let score = 0;

  if (request.intent.category && matchesCategory(candidate, request.intent.category)) {
    score += profile === "CATEGORY_SPECIFIC" ? 35 : 30;
    pushReason(reasons, "CATEGORY_MATCH");
  }

  for (const term of request.intent.desiredTerms ?? []) {
    if (includesTerm(candidate.name, term)) {
      score += profile === "MATCH_PREFERENCES" ? 12 : 10;
      pushReason(reasons, "NAME_MATCH");
      matchedTerms.push(term);
      continue;
    }
    if (includesTerm(candidate.description, term)) {
      score += profile === "MATCH_PREFERENCES" ? 10 : 8;
      pushReason(reasons, "DESCRIPTION_MATCH");
      matchedTerms.push(term);
      continue;
    }
    if ((candidate.optionTerms ?? []).some((value) => includesTerm(value, term))) {
      score += profile === "MATCH_PREFERENCES" ? 8 : 6;
      pushReason(reasons, "OPTION_MATCH");
      matchedTerms.push(term);
    }
  }

  if (request.intent.budgetMax != null) {
    score += profile === "BUDGET" ? 25 : 20;
    pushReason(reasons, "WITHIN_BUDGET");
  }

  if (candidate.promotionActive) {
    score += request.intent.promotionPreferred || profile === "PROMOTION" ? 15 : 5;
    pushReason(reasons, "PROMOTION_ACTIVE");
    if (request.intent.promotionPreferred) pushReason(reasons, "PROMOTION_REQUEST_MATCH");
  }

  if (candidate.isBestseller) {
    score += 8;
    pushReason(reasons, "BESTSELLER");
  }
  if (candidate.isFeatured) {
    score += 5;
    pushReason(reasons, "FEATURED_BY_RESTAURANT");
  }
  if (candidate.isWeeklyFavorite) {
    score += 4;
    pushReason(reasons, "WEEKLY_FAVORITE");
  }

  return {
    productId: candidate.productId,
    score,
    regularPrice: candidate.regularPrice,
    effectivePrice: candidate.effectivePrice,
    promotionActive: candidate.promotionActive,
    reasonCodes: reasons,
    matchedTerms: [...new Set(matchedTerms)],
  };
}

function confidenceFor(items: ChefRecommendationItem[]): "HIGH" | "MEDIUM" | "LOW" {
  if (items.length === 0) return "LOW";
  if (items[0].score >= 45) return "HIGH";
  if (items[0].score >= 20) return "MEDIUM";
  return "LOW";
}

function fallbackReasonFor(
  request: ChefRecommendationRequest,
  tenantCandidates: ChefRecommendationCandidate[],
  categoryCandidates: ChefRecommendationCandidate[],
): ChefRecommendationFallbackReason {
  if (request.intent.category && categoryCandidates.length === 0) return "CATEGORY_NOT_AVAILABLE";
  if (
    request.intent.budgetMax != null &&
    categoryCandidates.some((candidate) => candidate.effectivePrice > request.intent.budgetMax!)
  ) {
    return "NO_RESULT_WITHIN_BUDGET";
  }
  if ((request.intent.desiredTerms?.length ?? 0) > 0 && tenantCandidates.length > 0) {
    return "DESIRED_TERM_NOT_FOUND";
  }
  return "NO_MATCH";
}

export function recommendProducts(
  request: ChefRecommendationRequest,
  candidates: ChefRecommendationCandidate[],
): ChefRecommendationResult {
  const profile = profileFor(request);
  const limit = Math.max(1, Math.min(request.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
  const excludedTerms = request.intent.excludedTerms ?? [];

  const tenantCandidates = candidates.filter(
    (candidate) =>
      candidate.restaurantId === request.restaurantId &&
      candidate.isActive &&
      candidate.isAvailable &&
      !candidate.isPaused &&
      Number.isFinite(candidate.effectivePrice) &&
      candidate.effectivePrice >= 0,
  );

  const categoryCandidates = request.intent.category
    ? tenantCandidates.filter((candidate) => matchesCategory(candidate, request.intent.category!))
    : tenantCandidates;

  const eligible = categoryCandidates.filter((candidate) => {
    if (hasExcludedTerm(candidate, excludedTerms)) return false;
    if (request.intent.budgetMax != null && candidate.effectivePrice > request.intent.budgetMax) {
      return false;
    }
    if (
      request.intent.promotionPreferred &&
      profile === "PROMOTION" &&
      !candidate.promotionActive
    ) {
      return false;
    }
    return true;
  });

  let ranked = eligible
    .map((candidate) => scoreCandidate(candidate, request, profile))
    .sort((a, b) => b.score - a.score || a.effectivePrice - b.effectivePrice);

  if (profile === "BUDGET") {
    ranked = ranked.sort((a, b) => a.effectivePrice - b.effectivePrice || b.score - a.score);
    ranked = ranked.map((item, index) => ({
      ...item,
      reasonCodes:
        index === 0
          ? [...new Set([...item.reasonCodes, "LOW_PRICE" as const])]
          : item.reasonCodes,
    }));
  }

  const recommendations = ranked.slice(0, limit).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  return {
    recommendations,
    confidence: confidenceFor(recommendations),
    ...(recommendations.length === 0
      ? { fallbackReason: fallbackReasonFor(request, tenantCandidates, categoryCandidates) }
      : {}),
    diagnostics: {
      candidateCount: candidates.length,
      eligibleCount: eligible.length,
      rankingProfile: profile,
    },
  };
}

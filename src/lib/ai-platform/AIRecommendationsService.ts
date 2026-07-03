export interface DomainRecommendationInput {
  from_analytics?: string[];
  from_customer_intelligence?: string[];
  from_product_intelligence?: string[];
  from_finance?: string[];
  from_marketing?: string[];
}

export interface AIRecommendation {
  source: keyof DomainRecommendationInput;
  message: string;
  priority: number;
}

/**
 * Never generates new business rules. Simply aggregates and ranks
 * recommendations already produced by other domain Services.
 */
export const AIRecommendationsService = {
  aggregate(input: DomainRecommendationInput): AIRecommendation[] {
    const out: AIRecommendation[] = [];
    const priorities: Record<keyof DomainRecommendationInput, number> = {
      from_analytics: 6,
      from_customer_intelligence: 8,
      from_product_intelligence: 5,
      from_finance: 9,
      from_marketing: 7,
    };
    for (const key of Object.keys(priorities) as Array<keyof DomainRecommendationInput>) {
      for (const msg of input[key] ?? []) {
        out.push({ source: key, message: msg, priority: priorities[key] });
      }
    }
    return out.sort((a, b) => b.priority - a.priority);
  },
} as const;

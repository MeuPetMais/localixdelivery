import type { OrderingStrategy } from "./types";

export interface OrderingInput {
  productId: string;
  displayOrder?: number;
  createdAt?: string;
  salesCount?: number;
  profitAmount?: number;
  aiScore?: number;
}

/**
 * OrderingService — pure sort strategies for catalog products.
 * Strategies:
 *   - manual         : display_order asc
 *   - best_sellers   : salesCount desc
 *   - most_profitable: profitAmount desc
 *   - recent         : createdAt desc
 *   - ai             : aiScore desc (placeholder — engine will feed values)
 */
export const OrderingService = {
  apply<T extends OrderingInput>(items: T[], strategy: OrderingStrategy): T[] {
    const arr = [...items];
    switch (strategy) {
      case "best_sellers":
        return arr.sort((a, b) => (b.salesCount ?? 0) - (a.salesCount ?? 0));
      case "most_profitable":
        return arr.sort((a, b) => (b.profitAmount ?? 0) - (a.profitAmount ?? 0));
      case "recent":
        return arr.sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0));
      case "ai":
        return arr.sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0));
      case "manual":
      default:
        return arr.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    }
  },
} as const;

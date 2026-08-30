import { describe, expect, it } from "vitest";
import { recommendMenuItems } from "./recommend-menu-items";
import type { ChefCatalogService } from "../catalog/catalog-service";
import type { ChefRecommendationCandidate } from "../types";

const restaurantId = "restaurant-a";

function candidate(overrides: Partial<ChefRecommendationCandidate>): ChefRecommendationCandidate {
  return {
    productId: "product-a",
    restaurantId,
    name: "X-Bacon",
    description: "Hambúrguer com bacon",
    category: "Hambúrgueres",
    regularPrice: 35,
    effectivePrice: 30,
    promotionActive: true,
    isActive: true,
    isAvailable: true,
    isPaused: false,
    optionTerms: [],
    ...overrides,
  };
}

describe("Chef recommend-menu-items tool", () => {
  it("encaminha somente o tenant confiável para o Catalog Service", async () => {
    const calls: Array<{ restaurantId: string }> = [];
    const catalogService: ChefCatalogService = {
      async listRecommendationCandidates(input) {
        calls.push({ restaurantId: input.restaurantId });
        return [candidate({})];
      },
    };

    await recommendMenuItems(
      { restaurantId, intent: { desiredTerms: ["bacon"] } },
      catalogService,
    );

    expect(calls).toEqual([{ restaurantId }]);
  });

  it("mantém o hard filter de tenant mesmo se o repositório devolver dado contaminado", async () => {
    const catalogService: ChefCatalogService = {
      async listRecommendationCandidates() {
        return [
          candidate({ productId: "safe" }),
          candidate({ productId: "foreign", restaurantId: "restaurant-b" }),
        ];
      },
    };

    const result = await recommendMenuItems({ restaurantId, intent: {}, limit: 5 }, catalogService);

    expect(result.recommendations.map((item) => item.productId)).toContain("safe");
    expect(result.recommendations.map((item) => item.productId)).not.toContain("foreign");
  });

  it("preserva orçamento e preço efetivo fornecido pelo catálogo", async () => {
    const catalogService: ChefCatalogService = {
      async listRecommendationCandidates() {
        return [
          candidate({ productId: "promo", regularPrice: 40, effectivePrice: 32 }),
          candidate({ productId: "expensive", regularPrice: 45, effectivePrice: 45, promotionActive: false }),
        ];
      },
    };

    const result = await recommendMenuItems(
      { restaurantId, intent: { budgetMax: 35 }, limit: 5 },
      catalogService,
    );

    expect(result.recommendations.map((item) => item.productId)).toEqual(["promo"]);
    expect(result.recommendations[0].effectivePrice).toBe(32);
  });
});

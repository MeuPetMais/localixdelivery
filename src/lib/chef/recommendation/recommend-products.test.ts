import { describe, expect, it } from "vitest";
import { recommendProducts } from "./recommend-products";
import type { ChefRecommendationCandidate } from "../types";

const restaurantId = "restaurant-a";

function product(
  overrides: Partial<ChefRecommendationCandidate> & Pick<ChefRecommendationCandidate, "productId" | "name">,
): ChefRecommendationCandidate {
  return {
    productId: overrides.productId,
    restaurantId,
    name: overrides.name,
    description: "",
    category: "Hambúrgueres",
    regularPrice: 30,
    effectivePrice: 30,
    promotionActive: false,
    isActive: true,
    isAvailable: true,
    isPaused: false,
    optionTerms: [],
    ...overrides,
  };
}

const catalog: ChefRecommendationCandidate[] = [
  product({
    productId: "x-bacon",
    name: "X-Bacon",
    description: "Hambúrguer com queijo e bacon",
    effectivePrice: 32,
    regularPrice: 32,
    isBestseller: true,
  }),
  product({
    productId: "mega-bacon",
    name: "Mega Bacon",
    description: "Hambúrguer duplo com bacon",
    effectivePrice: 42,
    regularPrice: 42,
    isFeatured: true,
  }),
  product({
    productId: "combo-bacon",
    name: "Combo Bacon",
    description: "Hambúrguer com bacon, batata e bebida",
    category: "Combos",
    effectivePrice: 38,
    regularPrice: 45,
    promotionActive: true,
  }),
  product({
    productId: "x-cebola",
    name: "X-Cebola",
    description: "Hambúrguer com bacon e cebola caramelizada",
    effectivePrice: 29,
    regularPrice: 29,
  }),
  product({
    productId: "dessert",
    name: "Brownie",
    description: "Brownie com sorvete",
    category: "Sobremesas",
    effectivePrice: 15,
    regularPrice: 15,
  }),
];

describe("Chef Recommendation Engine V1", () => {
  it("aplica tenant, atividade, disponibilidade e pausa como hard filters", () => {
    const result = recommendProducts(
      { restaurantId, intent: {}, limit: 5 },
      [
        ...catalog,
        product({ productId: "paused", name: "Pausado", isPaused: true }),
        product({ productId: "inactive", name: "Inativo", isActive: false }),
        product({ productId: "unavailable", name: "Indisponível", isAvailable: false }),
        product({ productId: "other-tenant", name: "Outro", restaurantId: "restaurant-b" }),
      ],
    );

    expect(result.recommendations.map((item) => item.productId)).not.toEqual(
      expect.arrayContaining(["paused", "inactive", "unavailable", "other-tenant"]),
    );
  });

  it("nunca recomenda produto acima do orçamento quando há limite explícito", () => {
    const result = recommendProducts(
      {
        restaurantId,
        intent: { category: "hambúrguer", budgetMax: 40, desiredTerms: ["bacon"] },
      },
      catalog,
    );

    expect(result.recommendations.map((item) => item.productId)).toContain("x-bacon");
    expect(result.recommendations.map((item) => item.productId)).not.toContain("mega-bacon");
    expect(result.recommendations.every((item) => item.effectivePrice <= 40)).toBe(true);
  });

  it("exclui candidato quando termo rejeitado aparece na descrição", () => {
    const result = recommendProducts(
      {
        restaurantId,
        intent: { category: "hambúrguer", desiredTerms: ["bacon"], excludedTerms: ["cebola"] },
      },
      catalog,
    );

    expect(result.recommendations.map((item) => item.productId)).not.toContain("x-cebola");
  });

  it("não mistura categoria claramente incompatível", () => {
    const result = recommendProducts(
      { restaurantId, intent: { category: "sobremesa" } },
      catalog,
    );

    expect(result.recommendations.map((item) => item.productId)).toEqual(["dessert"]);
  });

  it("PROMOTION exige promoção ativa quando preferência é explícita", () => {
    const result = recommendProducts(
      { restaurantId, intent: { promotionPreferred: true }, rankingProfile: "PROMOTION" },
      catalog,
    );

    expect(result.recommendations.map((item) => item.productId)).toEqual(["combo-bacon"]);
    expect(result.recommendations[0].reasonCodes).toContain("PROMOTION_REQUEST_MATCH");
  });

  it("BUDGET ordena pelo menor preço sem violar o catálogo elegível", () => {
    const result = recommendProducts(
      { restaurantId, intent: {}, rankingProfile: "BUDGET", limit: 3 },
      catalog,
    );

    expect(result.recommendations[0].productId).toBe("dessert");
    expect(result.recommendations[0].reasonCodes).toContain("LOW_PRICE");
  });

  it("retorna fallback de orçamento sem recomendar acima do limite", () => {
    const result = recommendProducts(
      { restaurantId, intent: { category: "hambúrguer", budgetMax: 10 } },
      catalog,
    );

    expect(result.recommendations).toEqual([]);
    expect(result.fallbackReason).toBe("NO_RESULT_WITHIN_BUDGET");
  });

  it("limita recomendações e mantém reason codes baseados em evidência", () => {
    const result = recommendProducts(
      {
        restaurantId,
        intent: { desiredTerms: ["bacon"], budgetMax: 40 },
        limit: 2,
      },
      catalog,
    );

    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0].reasonCodes).toContain("WITHIN_BUDGET");
    expect(result.recommendations[0].matchedTerms).toContain("bacon");
  });
});

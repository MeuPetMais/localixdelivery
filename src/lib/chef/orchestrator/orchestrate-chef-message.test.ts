import { describe, expect, it } from "vitest";
import { orchestrateChefMessage } from "./orchestrate-chef-message";
import type { ChefCatalogService } from "../catalog/catalog-service";
import type { ChefContext, ChefRecommendationCandidate } from "../types";

const context: ChefContext = {
  restaurantId: "restaurant-a",
  channel: "text",
  locale: "pt-BR",
};

function catalog(candidates: ChefRecommendationCandidate[]): ChefCatalogService {
  return {
    async listRecommendationCandidates(input) {
      expect(input.restaurantId).toBe(context.restaurantId);
      return candidates;
    },
  };
}

const candidate: ChefRecommendationCandidate = {
  productId: "product-a",
  restaurantId: "restaurant-a",
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
};

describe("Chef orchestrator", () => {
  it("mantém tenant fora do parser e usa o contexto confiável no catálogo", async () => {
    const parserCalls: unknown[] = [];
    const result = await orchestrateChefMessage(
      context,
      { message: "quero bacon até 40", limit: 3 },
      {
        intentParser: {
          async parse(input) {
            parserCalls.push(input);
            return { intent: { desiredTerms: ["bacon"], budgetMax: 40 } };
          },
        },
        presenter: {
          async present(input) {
            return `Encontrei ${input.recommendation.recommendations.length} opção.`;
          },
        },
        catalogService: catalog([candidate]),
      },
    );

    expect(parserCalls).toEqual([{ message: "quero bacon até 40", locale: "pt-BR" }]);
    expect(JSON.stringify(parserCalls)).not.toContain("restaurant-a");
    expect(result.type).toBe("recommendation");
    if (result.type === "recommendation") {
      expect(result.recommendation.recommendations[0].productId).toBe("product-a");
    }
  });

  it("faz clarification sem consultar catálogo", async () => {
    let catalogCalled = false;
    const result = await orchestrateChefMessage(
      context,
      { message: "não sei" },
      {
        intentParser: {
          async parse() {
            return {
              intent: {},
              needsClarification: true,
              clarificationQuestion: "Prefere pizza ou lanche?",
            };
          },
        },
        presenter: {
          async present() {
            throw new Error("presenter should not run");
          },
        },
        catalogService: {
          async listRecommendationCandidates() {
            catalogCalled = true;
            return [];
          },
        },
      },
    );

    expect(catalogCalled).toBe(false);
    expect(result).toEqual({
      type: "clarification",
      text: "Prefere pizza ou lanche?",
      intent: {},
    });
  });

  it("rejeita mensagem vazia antes de chamar IA ou catálogo", async () => {
    let called = false;
    await expect(
      orchestrateChefMessage(
        context,
        { message: "   " },
        {
          intentParser: {
            async parse() {
              called = true;
              return { intent: {} };
            },
          },
          presenter: {
            async present() {
              called = true;
              return "";
            },
          },
          catalogService: {
            async listRecommendationCandidates() {
              called = true;
              return [];
            },
          },
        },
      ),
    ).rejects.toThrow("CHEF_EMPTY_MESSAGE");
    expect(called).toBe(false);
  });
});

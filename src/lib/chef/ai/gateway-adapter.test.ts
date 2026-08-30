import { describe, expect, it, vi } from "vitest";
import {
  CHEF_AI_MODEL_CANDIDATES,
  createGatewayIntentParser,
  createGatewayResponsePresenter,
} from "./gateway-adapter";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Chef AI Gateway adapter", () => {
  it("faz parse estruturado sem enviar restaurantId para o modelo", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe(CHEF_AI_MODEL_CANDIDATES.primary);
      expect(JSON.stringify(body)).not.toContain("restaurant-a");
      expect(body.response_format.type).toBe("json_schema");
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: "Hambúrgueres",
                budgetMax: 40,
                desiredTerms: ["bacon"],
                excludedTerms: ["cebola"],
                promotionPreferred: false,
                peopleCount: 1,
                rankingProfile: "MATCH_PREFERENCES",
                needsClarification: false,
                clarificationQuestion: null,
              }),
            },
          },
        ],
        usage: { prompt_tokens: 80, completion_tokens: 30 },
      });
    });

    const usage: unknown[] = [];
    const parser = createGatewayIntentParser({
      fetchImpl: fetchImpl as typeof fetch,
      apiKey: "test-key",
      onUsage: (item) => usage.push(item),
    });

    const result = await parser.parse({
      message: "Quero um lanche com bacon, sem cebola e até R$ 40",
      locale: "pt-BR",
    });

    expect(result.intent.budgetMax).toBe(40);
    expect(result.intent.desiredTerms).toEqual(["bacon"]);
    expect(result.intent.excludedTerms).toEqual(["cebola"]);
    expect(result.rankingProfile).toBe("MATCH_PREFERENCES");
    expect(usage).toHaveLength(1);
  });

  it("apresentador recebe somente resultado autorizado e não recebe productId", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain("product-a");
      expect(serialized).not.toContain("restaurant-a");
      return jsonResponse({
        choices: [{ message: { content: "Encontrei opções que combinam com o que você pediu. Veja os cards abaixo." } }],
      });
    });

    const presenter = createGatewayResponsePresenter({
      fetchImpl: fetchImpl as typeof fetch,
      apiKey: "test-key",
    });

    const text = await presenter.present({
      message: "Quero algo com bacon",
      intent: { desiredTerms: ["bacon"] },
      recommendation: {
        confidence: "HIGH",
        recommendations: [
          {
            productId: "product-a",
            rank: 1,
            score: 50,
            regularPrice: 35,
            effectivePrice: 30,
            promotionActive: true,
            reasonCodes: ["NAME_MATCH", "PROMOTION_ACTIVE"],
            matchedTerms: ["bacon"],
          },
        ],
        diagnostics: { candidateCount: 4, eligibleCount: 2, rankingProfile: "MATCH_PREFERENCES" },
      },
      locale: "pt-BR",
    });

    expect(text).toContain("cards");
  });

  it("falha fechado quando não existe credencial do gateway", async () => {
    const oldApiKey = process.env.AI_GATEWAY_API_KEY;
    const oldOidc = process.env.VERCEL_OIDC_TOKEN;
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;

    try {
      const parser = createGatewayIntentParser({
        fetchImpl: vi.fn() as unknown as typeof fetch,
      });
      await expect(parser.parse({ message: "Quero pizza" })).rejects.toThrow(
        "CHEF_AI_GATEWAY_AUTH_MISSING",
      );
    } finally {
      if (oldApiKey) process.env.AI_GATEWAY_API_KEY = oldApiKey;
      if (oldOidc) process.env.VERCEL_OIDC_TOKEN = oldOidc;
    }
  });

  it("marca 429 como erro retryable sem retornar texto inventado", async () => {
    const parser = createGatewayIntentParser({
      apiKey: "test-key",
      fetchImpl: (async () => jsonResponse({ error: "rate limit" }, 429)) as typeof fetch,
    });

    await expect(parser.parse({ message: "Quero pizza" })).rejects.toThrow(
      "CHEF_AI_GATEWAY_RETRYABLE_429",
    );
  });
});
